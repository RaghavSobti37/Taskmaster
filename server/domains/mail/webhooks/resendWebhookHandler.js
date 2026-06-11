const Campaign = require('../models/Campaign');
const MailCampaign = require('../models/MailCampaign');
const MailEvent = require('../models/MailEvent');
const Lead = require('../../../models/Lead');
const { updateEmailTags } = require('../../../services/mailService');
const {
  isValidDisplayCity,
  isEmailImageProxy,
  isEmailLinkScanner,
  isGoogleInfrastructureIp,
  lookupGeoAsync,
  lookupGeoForClick,
  normalizeIp,
} = require('../../../utils/geoLookup');

/** Track host: /webhooks/resend — locked geo + tag-based campaign lookup */
async function handleTrackResendWebhook(req, res) {
  try {
    const { Webhook } = require('svix');
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) {
      return res.status(500).send('Webhook secret unconfigured');
    }
    const wh = new Webhook(secret);

    let payload;
    const isProd = process.env.NODE_ENV === 'production';
    const hasSvixHeaders = (req.headers['svix-signature'] || req.headers['resend-signature'] || req.headers['resend-webhook-signature']);

    if (isProd || hasSvixHeaders) {
      try {
        const rawBodyStr = req.rawBody ? req.rawBody.toString('utf8') : '';
        const svixHeaders = {
          'svix-id': req.headers['svix-id'] || req.headers['resend-webhook-id'],
          'svix-timestamp': req.headers['svix-timestamp'] || req.headers['resend-webhook-timestamp'],
          'svix-signature': req.headers['svix-signature'] || req.headers['resend-signature'] || req.headers['resend-webhook-signature'],
        };
        payload = wh.verify(rawBodyStr, svixHeaders);
      } catch (err) {
        console.error('Resend Webhook Signature Verification Failed:', err.message);
        if (isProd) {
          return res.status(400).send('Invalid webhook signature');
        }
        payload = req.body;
      }
    } else {
      payload = req.body;
    }

    if (!payload || !payload.type || !payload.data) {
      return res.status(400).send('Invalid payload');
    }

    const eventType = payload.type;
    const emailId = payload.data.email_id;
    const email = Array.isArray(payload.data.to) ? payload.data.to[0] : (payload.data.to || payload.data.email);

    if (!email) {
      return res.status(200).send('No recipient email found');
    }

    const cleanEmail = email.toLowerCase().trim();

    console.log(`⚡ [Resend Webhook] Processing event: ${eventType} for ${cleanEmail} (Email ID: ${emailId || 'N/A'})`);

    let camp = null;
    let isCore = true;
    let recipient = null;

    let resendCampaignId = null;
    let resendRecipientId = null;
    if (payload.data.tags && Array.isArray(payload.data.tags)) {
      const campTag = payload.data.tags.find((t) => t.name === 'campaign_id');
      const recTag = payload.data.tags.find((t) => t.name === 'recipient_id');
      if (campTag) resendCampaignId = campTag.value;
      if (recTag) resendRecipientId = recTag.value;
    }

    if (resendCampaignId) {
      camp = await Campaign.findById(resendCampaignId);
      if (camp) {
        recipient = camp.recipients?.id ? camp.recipients.id(resendRecipientId) : camp.recipients?.find((r) => r._id && r._id.toString() === resendRecipientId);
      }
      if (!camp) {
        camp = await MailCampaign.findById(resendCampaignId);
        if (camp) {
          isCore = false;
          recipient = camp.recipients?.id ? camp.recipients.id(resendRecipientId) : camp.recipients?.find((r) => r._id && r._id.toString() === resendRecipientId);
        }
      }
    }

    if (!camp && emailId) {
      camp = await Campaign.findOne({ 'recipients.messageId': emailId });
      if (camp) {
        recipient = camp.recipients.find((r) => r.messageId === emailId);
      }
      if (!camp) {
        camp = await MailCampaign.findOne({ 'recipients.messageId': emailId });
        if (camp) {
          isCore = false;
          recipient = camp.recipients.find((r) => r.messageId === emailId);
        }
      }
    }

    if (!recipient) {
      camp = await Campaign.findOne({ 'recipients.email': cleanEmail }).sort({ updatedAt: -1 });
      if (camp) {
        isCore = true;
        recipient = camp.recipients.find((r) => r.email && r.email.toLowerCase() === cleanEmail);
      } else {
        camp = await MailCampaign.findOne({ 'recipients.email': cleanEmail }).sort({ updatedAt: -1 });
        if (camp) {
          isCore = false;
          recipient = camp.recipients.find((r) => r.email && r.email.toLowerCase() === cleanEmail);
        }
      }
    }

    let locationObj = null;
    let ip = '';
    let userAgent = 'Unknown';
    let url = '';

    if (eventType === 'email.opened' || eventType === 'email.clicked') {
      if (eventType === 'email.clicked') {
        ip = payload.data.click?.ipAddress || payload.data.click?.ip_address || payload.data.ip_address || payload.data.ipAddress || '';
        userAgent = payload.data.click?.userAgent || payload.data.click?.user_agent || payload.data.user_agent || payload.data.userAgent || 'Unknown';
        url = payload.data.click?.link || payload.data.url || '';
      } else if (eventType === 'email.opened') {
        ip = payload.data.open?.ipAddress || payload.data.open?.ip_address || payload.data.ip_address || payload.data.ipAddress || '';
        userAgent = payload.data.open?.userAgent || payload.data.open?.user_agent || payload.data.user_agent || payload.data.userAgent || 'Unknown';
      }

      ip = normalizeIp(ip);

      if (eventType === 'email.clicked') {
        if (!isEmailLinkScanner(userAgent) && ip) {
          const geo = await lookupGeoForClick(ip);
          if (!geo.untrusted && isValidDisplayCity(geo.city)) {
            locationObj = { city: geo.city, country: geo.country || undefined };
          }
        }
      } else if (ip && !isEmailImageProxy(userAgent) && !isGoogleInfrastructureIp(ip)) {
        const geo = await lookupGeoAsync(ip);
        if (isValidDisplayCity(geo.city)) {
          locationObj = { city: geo.city, country: geo.country || undefined };
        }
      }
    }

    const isWebhookBot = isEmailLinkScanner(userAgent);

    if (eventType === 'email.bounced' || eventType === 'email.complained') {
      if (recipient) {
        recipient.status = 'Bounced';
        recipient.error = payload.data.error?.message || payload.data.error || 'Bounced via webhook';
        if (isCore) {
          camp.metrics.bounced = (camp.metrics.bounced || 0) + 1;
        } else {
          camp.stats.bounced = (camp.stats.bounced || 0) + 1;
        }
        await camp.save();
      }

      const coreCamps = await Campaign.find({ 'recipients.email': cleanEmail });
      for (const c of coreCamps) {
        let changed = false;
        c.recipients?.forEach((r) => {
          if (r.email === cleanEmail && r.status !== 'Bounced') {
            r.status = 'Bounced';
            changed = true;
          }
        });
        if (changed) {
          if (!c.metrics) c.metrics = { totalSent: 0, opened: 0, clicked: 0, bounced: 0 };
          c.metrics.bounced = (c.metrics.bounced || 0) + 1;
          await c.save();
        }
      }

      const mailCamps = await MailCampaign.find({ 'recipients.email': cleanEmail });
      for (const mc of mailCamps) {
        let changed = false;
        mc.recipients?.forEach((r) => {
          if (r.email === cleanEmail && r.status !== 'Bounced') {
            r.status = 'Bounced';
            changed = true;
          }
        });
        if (changed) {
          mc.stats.bounced = (mc.stats.bounced || 0) + 1;
          await mc.save();
        }
      }

      await Lead.updateOne(
        { email: cleanEmail },
        { $inc: { bounceCount: 1 }, $set: { emailStatus: 'Bounced', status: 'inactive' } },
      );
      await updateEmailTags(cleanEmail, 'Invalid', 'Invalid');

      await MailEvent.create({
        eventType: 'Bounce',
        email: cleanEmail,
        timestamp: payload.created_at || new Date(),
        campaignId: camp?._id,
        messageId: emailId,
        metadata: {
          source: 'RESEND_WEBHOOK',
          error: payload.data.error?.message || payload.data.error || 'Bounced',
        },
      });
    } else if (eventType === 'email.opened') {
      if (isWebhookBot) return res.status(200).send('Ignored bot open');

      if (recipient) {
        if (!['Clicked', 'Bounced', 'Unsubscribed', 'Invalid'].includes(recipient.status)) {
          recipient.status = 'Opened';

          if (isCore) {
            camp.metrics.opened = (camp.metrics.opened || 0) + 1;
            camp.timeSeries.push({ time: new Date(), opens: 1, clicks: 0 });
          } else {
            camp.stats.opened = (camp.stats.opened || 0) + 1;
          }
          await camp.save();
        }
      }

      await Lead.updateOne(
        { email: cleanEmail },
        { $set: { status: 'active', emailStatus: 'Active' } },
      );
      await updateEmailTags(cleanEmail, 'Active', 'Active');

      await MailEvent.create({
        eventType: 'Open',
        email: cleanEmail,
        timestamp: payload.created_at || new Date(),
        campaignId: camp?._id,
        messageId: emailId,
        ipAddress: ip || undefined,
        userAgent,
        ...(locationObj ? { location: locationObj } : {}),
      });
    } else if (eventType === 'email.clicked') {
      if (isWebhookBot) return res.status(200).send('Ignored bot click');

      if (recipient) {
        if (!['Bounced', 'Unsubscribed', 'Invalid'].includes(recipient.status)) {
          recipient.status = 'Clicked';

          if (isCore) {
            camp.metrics.clicked = (camp.metrics.clicked || 0) + 1;
            const city = locationObj?.city;
            if (isValidDisplayCity(city)) {
              if (!camp.locationBreakdown) {
                camp.locationBreakdown = new Map();
              }
              const locData = camp.locationBreakdown.get(city) || { opens: 0, clicks: 0 };
              camp.locationBreakdown.set(city, {
                opens: locData.opens || 0,
                clicks: (locData.clicks || 0) + 1,
              });
              camp.markModified('locationBreakdown');
            }
            camp.timeSeries.push({ time: new Date(), opens: 0, clicks: 1 });
          } else {
            camp.stats.clicked = (camp.stats.clicked || 0) + 1;
          }
          await camp.save();
        }
      }

      await Lead.updateOne(
        { email: cleanEmail },
        { $set: { status: 'engaged', emailStatus: 'Active' } },
      );
      await updateEmailTags(cleanEmail, 'Active', 'Active');

      await MailEvent.create({
        eventType: 'Click',
        email: cleanEmail,
        timestamp: payload.created_at || new Date(),
        campaignId: camp?._id,
        messageId: emailId,
        linkClicked: url,
        ipAddress: ip || undefined,
        userAgent,
        ...(locationObj ? { location: locationObj } : {}),
      });
    } else if (eventType === 'email.delivered') {
      if (recipient) {
        if (recipient.status === 'Pending') {
          recipient.status = 'Sent';
          await camp.save();
        }
      }

      await MailEvent.create({
        eventType: 'Delivery',
        email: cleanEmail,
        timestamp: payload.created_at || new Date(),
        campaignId: camp?._id,
        messageId: emailId,
      });
    }

    res.status(200).send('Webhook processed');
  } catch (err) {
    console.error('Resend Webhook Error:', err);
    res.status(500).send('Server Error');
  }
}

/** API host: /api/webhooks/resend — legacy geoip-lite path + metadata events */
async function handleApiResendWebhook(req, res) {
  try {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (secret) {
      const { Webhook } = require('svix');
      const wh = new Webhook(secret);
      const svix_id = req.headers['svix-id'];
      const svix_timestamp = req.headers['svix-timestamp'];
      const svix_signature = req.headers['svix-signature'];

      if (!svix_id || !svix_timestamp || !svix_signature) {
        return res.status(400).send('MISSING_SVIX_HEADERS');
      }

      const payloadString = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
      try {
        wh.verify(payloadString, {
          'svix-id': svix_id,
          'svix-timestamp': svix_timestamp,
          'svix-signature': svix_signature,
        });
      } catch (err) {
        console.warn('❌ [Resend Webhook] Signature verification failed:', err.message);
        return res.status(401).send('INVALID_SIGNATURE');
      }
    }

    const payload = req.body;
    if (!payload || !payload.type || !payload.data) {
      return res.status(400).send('INVALID_PAYLOAD');
    }

    const eventType = payload.type;
    const emailId = payload.data.email_id;
    const email = Array.isArray(payload.data.to) ? payload.data.to[0] : (payload.data.to || payload.data.email);

    if (!email) {
      return res.status(200).send('NO_EMAIL_FOUND');
    }

    const cleanEmail = email.toLowerCase().trim();
    const geoip = require('geoip-lite');

    console.log(`⚡ [Resend Webhook API] Processing event: ${eventType} for ${cleanEmail} (Email ID: ${emailId || 'N/A'})`);

    let camp = null;
    let isCore = true;
    let recipient = null;

    if (emailId) {
      camp = await Campaign.findOne({ 'recipients.messageId': emailId });
      if (camp) {
        recipient = camp.recipients.find((r) => r.messageId === emailId);
      }
      if (!camp) {
        camp = await MailCampaign.findOne({ 'recipients.messageId': emailId });
        if (camp) {
          isCore = false;
          recipient = camp.recipients.find((r) => r.messageId === emailId);
        }
      }
    }

    if (!recipient) {
      camp = await Campaign.findOne({ 'recipients.email': cleanEmail }).sort({ updatedAt: -1 });
      if (camp) {
        isCore = true;
        recipient = camp.recipients.find((r) => r.email && r.email.toLowerCase() === cleanEmail);
      } else {
        camp = await MailCampaign.findOne({ 'recipients.email': cleanEmail }).sort({ updatedAt: -1 });
        if (camp) {
          isCore = false;
          recipient = camp.recipients.find((r) => r.email && r.email.toLowerCase() === cleanEmail);
        }
      }
    }

    let locationObj = { city: 'Mumbai', region: 'MH', country: 'IN', ip: '127.0.0.1', userAgent: 'Unknown' };
    let locationString = 'Mumbai, MH, IN';
    let url = '';

    if (eventType === 'email.opened' || eventType === 'email.clicked') {
      let ip = '';
      let userAgent = 'Unknown';

      if (eventType === 'email.clicked') {
        ip = payload.data.click?.ipAddress || payload.data.ipAddress || '';
        userAgent = payload.data.click?.userAgent || payload.data.userAgent || 'Unknown';
        url = payload.data.click?.link || payload.data.url || '';
      } else if (eventType === 'email.opened') {
        ip = payload.data.open?.ipAddress || payload.data.ipAddress || '';
        userAgent = payload.data.open?.userAgent || payload.data.userAgent || 'Unknown';
      }

      if (ip && ip.includes(',')) {
        ip = ip.split(',')[0].trim();
      }

      if (ip && ip.startsWith('::ffff:')) {
        ip = ip.substring(7);
      }

      const isLocalIp = !ip || ip === '127.0.0.1' || ip === '::1' || ip.includes('127.0.0.1');
      const geo = !isLocalIp ? geoip.lookup(ip) : null;
      locationObj = {
        city: geo ? (geo.city || 'Unknown City') : (isLocalIp ? 'Mumbai' : 'Unknown City'),
        region: geo ? (geo.region || 'Unknown Region') : (isLocalIp ? 'MH' : 'Unknown Region'),
        country: geo ? (geo.country || 'Unknown Country') : (isLocalIp ? 'IN' : 'Unknown Country'),
        ip: ip || '127.0.0.1',
        userAgent,
      };
      locationString = `${locationObj.city}, ${locationObj.region}, ${locationObj.country}`;
    }

    if (eventType === 'email.bounced' || eventType === 'email.complained') {
      if (recipient) {
        recipient.status = 'Bounced';
        recipient.error = payload.data.error?.message || payload.data.error || 'Bounced via webhook';
        if (isCore) {
          camp.metrics.bounced = (camp.metrics.bounced || 0) + 1;
        } else {
          camp.stats.bounced = (camp.stats.bounced || 0) + 1;
        }
        await camp.save();
      }

      const coreCamps = await Campaign.find({ 'recipients.email': cleanEmail });
      for (const c of coreCamps) {
        let changed = false;
        c.recipients?.forEach((r) => {
          if (r.email === cleanEmail && r.status !== 'Bounced') {
            r.status = 'Bounced';
            changed = true;
          }
        });
        if (changed) {
          if (!c.metrics) c.metrics = { totalSent: 0, opened: 0, clicked: 0, bounced: 0 };
          c.metrics.bounced = (c.metrics.bounced || 0) + 1;
          await c.save();
        }
      }

      const mailCamps = await MailCampaign.find({ 'recipients.email': cleanEmail });
      for (const mc of mailCamps) {
        let changed = false;
        mc.recipients?.forEach((r) => {
          if (r.email === cleanEmail && r.status !== 'Bounced') {
            r.status = 'Bounced';
            changed = true;
          }
        });
        if (changed) {
          mc.stats.bounced = (mc.stats.bounced || 0) + 1;
          await mc.save();
        }
      }

      await Lead.updateOne(
        { email: cleanEmail },
        { $inc: { bounceCount: 1 }, $set: { emailStatus: 'Bounced', status: 'inactive' } },
      );
      await updateEmailTags(cleanEmail, 'Invalid', 'Invalid');

      await MailEvent.create({
        eventType: 'Bounce',
        email: cleanEmail,
        timestamp: payload.created_at || new Date(),
        campaignId: camp?._id,
        messageId: emailId,
        metadata: {
          source: 'RESEND_WEBHOOK',
          error: payload.data.error?.message || payload.data.error || 'Bounced',
        },
      });
    } else if (eventType === 'email.opened') {
      if (recipient) {
        if (!['Clicked', 'Bounced', 'Unsubscribed', 'Invalid'].includes(recipient.status)) {
          recipient.status = 'Opened';

          if (isCore) {
            camp.metrics.opened = (camp.metrics.opened || 0) + 1;
            const city = locationObj.city || 'Unknown City';
            if (!camp.locationBreakdown) {
              camp.locationBreakdown = new Map();
            }
            const locData = camp.locationBreakdown.get(city) || { opens: 0, clicks: 0 };
            camp.locationBreakdown.set(city, {
              opens: (locData.opens || 0) + 1,
              clicks: locData.clicks || 0,
            });
            camp.markModified('locationBreakdown');
            camp.timeSeries.push({ time: new Date(), opens: 1, clicks: 0 });
          } else {
            camp.stats.opened = (camp.stats.opened || 0) + 1;
          }
          await camp.save();
        }
      }

      await Lead.updateOne(
        { email: cleanEmail },
        { $set: { status: 'active', emailStatus: 'Active' } },
      );
      await updateEmailTags(cleanEmail, 'Active', 'Active');

      await MailEvent.create({
        eventType: 'Open',
        email: cleanEmail,
        timestamp: payload.created_at || new Date(),
        campaignId: camp?._id,
        messageId: emailId,
        metadata: {
          ip: locationObj.ip,
          location: locationString,
          city: locationObj.city,
          region: locationObj.region,
          country: locationObj.country,
          userAgent: locationObj.userAgent,
        },
      });
    } else if (eventType === 'email.clicked') {
      if (recipient) {
        if (!['Bounced', 'Unsubscribed', 'Invalid'].includes(recipient.status)) {
          recipient.status = 'Clicked';

          if (isCore) {
            camp.metrics.clicked = (camp.metrics.clicked || 0) + 1;
            const city = locationObj.city || 'Unknown City';
            if (!camp.locationBreakdown) {
              camp.locationBreakdown = new Map();
            }
            const locData = camp.locationBreakdown.get(city) || { opens: 0, clicks: 0 };
            camp.locationBreakdown.set(city, {
              opens: locData.opens || 0,
              clicks: (locData.clicks || 0) + 1,
            });
            camp.markModified('locationBreakdown');
            camp.timeSeries.push({ time: new Date(), opens: 0, clicks: 1 });
          } else {
            camp.stats.clicked = (camp.stats.clicked || 0) + 1;
          }
          await camp.save();
        }
      }

      await Lead.updateOne(
        { email: cleanEmail },
        { $set: { status: 'engaged', emailStatus: 'Active' } },
      );
      await updateEmailTags(cleanEmail, 'Active', 'Active');

      await MailEvent.create({
        eventType: 'Click',
        email: cleanEmail,
        timestamp: payload.created_at || new Date(),
        campaignId: camp?._id,
        messageId: emailId,
        metadata: {
          url,
          ip: locationObj.ip,
          location: locationString,
          city: locationObj.city,
          region: locationObj.region,
          country: locationObj.country,
          userAgent: locationObj.userAgent,
        },
      });
    } else if (eventType === 'email.delivered') {
      if (recipient) {
        if (recipient.status === 'Pending') {
          recipient.status = 'Sent';
          await camp.save();
        }
      }

      await MailEvent.create({
        eventType: 'Delivery',
        email: cleanEmail,
        timestamp: payload.created_at || new Date(),
        campaignId: camp?._id,
        messageId: emailId,
      });
    }

    res.status(200).send('SUCCESS');
  } catch (err) {
    console.error('Error in Resend webhook processing:', err);
    res.status(500).send('SERVER_ERROR');
  }
}

module.exports = {
  handleTrackResendWebhook,
  handleApiResendWebhook,
};
