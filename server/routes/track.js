const express = require('express');
const router = express.Router();
const geoip = require('geoip-lite');
const EmailLog = require('../models/EmailLog');
const Lead = require('../models/Lead');
const Campaign = require('../models/Campaign');
const { Reader } = require('@maxmind/geoip2-node');
const path = require('path');

let geoReader;
Reader.open(path.join(__dirname, '../geo/GeoLite2-City.mmdb'))
  .then(reader => { geoReader = reader; })
  .catch(err => console.error('Failed to load GeoIP Binary database', err));


const parseClientNetworkLocation = (req) => {
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (ip && ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }

  // Strip ::ffff: prefix if present (IPv4-mapped IPv6 address)
  if (ip && ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  // Handle local development network loops cleanly
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.includes('127.0.0.1')) {
    return { city: 'Mumbai', region: 'MH', country: 'IN', ip: '127.0.0.1' };
  }

  const geo = geoip.lookup(ip);
  return {
    city: geo ? (geo.city || 'Unknown City') : 'Unknown City',
    region: geo ? (geo.region || 'Unknown Region') : 'Unknown Region',
    country: geo ? (geo.country || 'Unknown Country') : 'Unknown Country',
    ip
  };
};

// Open Tracking Pixel Endpoint
router.get('/open/:pixelId.gif', async (req, res) => {
  try {
    const { pixelId } = req.params;
    const location = parseClientNetworkLocation(req);
    const city = location.city || 'Unknown';

    const userAgent = req.headers['user-agent'] || 'Unknown';
    const isBot = /bot|crawl|spider|yahoo|slurp|facebook|google|bing/i.test(userAgent);

    if (!isBot) {
      const log = await EmailLog.findOne({ pixelId });
      if (log && !log.opened) {
        await EmailLog.updateOne({ pixelId }, { $set: { opened: true } });
        await Lead.updateOne({ email: log.leadEmail }, { $set: { status: 'active', emailStatus: 'Active' } });

        const MailCampaign = require('../models/MailCampaign');
        const MailEvent = require('../models/MailEvent');

        let camp = await Campaign.findOne({ $or: [{ campaignId: String(log.campaignId) }, { _id: log.campaignId.match(/^[0-9a-fA-F]{24}$/) ? log.campaignId : null }] });
        let isCore = true;
        if (!camp) {
          camp = await MailCampaign.findOne({ _id: log.campaignId.match(/^[0-9a-fA-F]{24}$/) ? log.campaignId : null });
          isCore = false;
        }

        if (camp) {
          if (isCore) {
            camp.metrics.opened = (camp.metrics.opened || 0) + 1;
            camp.timeSeries.push({ time: new Date(), opens: 1, clicks: 0 });
          } else {
            camp.stats.opened = (camp.stats.opened || 0) + 1;
          }

          if (camp.recipients) {
            const rec = camp.recipients.find(r => r.email && r.email.toLowerCase() === log.leadEmail.toLowerCase());
            if (rec && !['Clicked', 'Unsubscribed', 'Bounced'].includes(rec.status)) {
              rec.status = 'Opened';
              await camp.save();
            }
          }

          await MailEvent.create({
            eventType: 'Open',
            email: log.leadEmail,
            timestamp: new Date(),
            campaignId: camp._id,
            ipAddress: location.ip || '127.0.0.1',
            userAgent,
            location: {
              country: location.country || 'Unknown',
              city: location.city || 'Unknown'
            }
          });
        }
      }
    }

    // Deliver a genuine, non-cached 1x1 transparent tracking pixel
    const buffer = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.writeHead(200, {
      'Content-Type': 'image/gif',
      'Content-Length': buffer.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache'
    });
    return res.end(buffer);
  } catch (err) {
    console.error('Pixel Tracking Interruption:', err);
    return res.status(500).end();
  }
});

// Click Tracking Redirect Wrapper
router.get('/click/:clickId', async (req, res) => {
  try {
    const { clickId } = req.params;
    const destinationUrl = req.query.redirect;
    const location = parseClientNetworkLocation(req);
    const city = location.city || 'Unknown';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    // Anti-Bot Protection
    const isBot = /bot|crawl|spider|yahoo|slurp|facebook|google|bing/i.test(userAgent);
    const fallbackRedirect = process.env.FRONTEND_URL || 'http://localhost:5173';
    const finalUrl = destinationUrl ? decodeURIComponent(destinationUrl) : fallbackRedirect;

    if (!isBot) {
      const log = await EmailLog.findOne({ clickId });
      if (log && !log.clicked) {
        await EmailLog.updateOne({ clickId }, { $set: { clicked: true } });
        await Lead.updateOne({ email: log.leadEmail }, { $set: { status: 'engaged', emailStatus: 'Active' } });

        const MailCampaign = require('../models/MailCampaign');
        const MailEvent = require('../models/MailEvent');

        let camp = await Campaign.findOne({ $or: [{ campaignId: String(log.campaignId) }, { _id: log.campaignId.match(/^[0-9a-fA-F]{24}$/) ? log.campaignId : null }] });
        let isCore = true;
        if (!camp) {
          camp = await MailCampaign.findOne({ _id: log.campaignId.match(/^[0-9a-fA-F]{24}$/) ? log.campaignId : null });
          isCore = false;
        }

        if (camp) {
          if (isCore) {
            camp.metrics.clicked = (camp.metrics.clicked || 0) + 1;
            if (!camp.locationBreakdown) camp.locationBreakdown = new Map();
            const locData = camp.locationBreakdown.get(city) || { opens: 0, clicks: 0 };
            camp.locationBreakdown.set(city, { opens: locData.opens || 0, clicks: (locData.clicks || 0) + 1 });
            camp.markModified('locationBreakdown');
            camp.timeSeries.push({ time: new Date(), opens: 0, clicks: 1 });
          } else {
            camp.stats.clicked = (camp.stats.clicked || 0) + 1;
          }

          if (camp.recipients) {
            const rec = camp.recipients.find(r => r.email && r.email.toLowerCase() === log.leadEmail.toLowerCase());
            if (rec && !['Unsubscribed', 'Bounced'].includes(rec.status)) {
              rec.status = 'Clicked';
              await camp.save();
            }
          }

          await MailEvent.create({
            eventType: 'Click',
            email: log.leadEmail,
            timestamp: new Date(),
            campaignId: camp._id,
            linkClicked: destinationUrl,
            ipAddress: location.ip || '127.0.0.1',
            userAgent,
            location: {
              country: location.country || 'Unknown',
              city: location.city || 'Unknown'
            }
          });
        }
      }
    }

    // JS Redirect to bypass strict security bots following 302s automatically
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta http-equiv="refresh" content="0; url=${finalUrl}">
          <title>Redirecting...</title>
        </head>
        <body>
          <script>window.location.href = "${finalUrl}";</script>
          <p>If you are not redirected automatically, <a href="${finalUrl}">click here</a>.</p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('Click Tracking Error:', err);
    return res.redirect(302, process.env.FRONTEND_URL || 'http://localhost:5173');
  }
});

// Unified Resend Webhook Handler (Opens, Clicks, Bounces, Delivered)
router.post('/webhooks/resend', async (req, res) => {
  try {
    const { Webhook } = require('svix');
    const secret = process.env.RESEND_WEBHOOK_SECRET || 'whsec_REDACTED';
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
          'svix-signature': req.headers['svix-signature'] || req.headers['resend-signature'] || req.headers['resend-webhook-signature']
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
    const MailCampaign = require('../models/MailCampaign');
    const MailEvent = require('../models/MailEvent');
    const { updateEmailTags } = require('../services/mailService');

    console.log(`⚡ [Resend Webhook] Processing event: ${eventType} for ${cleanEmail} (Email ID: ${emailId || 'N/A'})`);

    // 1. Locate Campaign and Recipient
    let camp = null;
    let isCore = true;
    let recipient = null;

    if (emailId) {
      camp = await Campaign.findOne({ 'recipients.messageId': emailId });
      if (camp) {
        recipient = camp.recipients.find(r => r.messageId === emailId);
      }
      if (!camp) {
        camp = await MailCampaign.findOne({ 'recipients.messageId': emailId });
        if (camp) {
          isCore = false;
          recipient = camp.recipients.find(r => r.messageId === emailId);
        }
      }
    }

    // Fallback: search by recipient email in the most recent campaign
    if (!recipient) {
      camp = await Campaign.findOne({ 'recipients.email': cleanEmail }).sort({ updatedAt: -1 });
      if (camp) {
        isCore = true;
        recipient = camp.recipients.find(r => r.email && r.email.toLowerCase() === cleanEmail);
      } else {
        camp = await MailCampaign.findOne({ 'recipients.email': cleanEmail }).sort({ updatedAt: -1 });
        if (camp) {
          isCore = false;
          recipient = camp.recipients.find(r => r.email && r.email.toLowerCase() === cleanEmail);
        }
      }
    }

    // 2. Geolocation parsing for open/click events
    let locationObj = { country: 'Unknown', city: 'Unknown' };
    let ip = '';
    let userAgent = 'Unknown';
    let url = '';

    if (eventType === 'email.opened' || eventType === 'email.clicked') {
      if (eventType === 'email.clicked') {
        ip = payload.data.click?.ipAddress || payload.data.ipAddress || '';
        userAgent = payload.data.click?.userAgent || payload.data.userAgent || 'Unknown';
        url = payload.data.click?.link || payload.data.url || '';
      } else if (eventType === 'email.opened') {
        ip = payload.data.open?.ipAddress || payload.data.ipAddress || '';
        userAgent = payload.data.open?.userAgent || payload.data.userAgent || 'Unknown';
      }

      if (ip && ip.includes(',')) ip = ip.split(',')[0].trim();
      if (ip && ip.startsWith('::ffff:')) ip = ip.substring(7);

      if (ip && geoReader && ip !== '127.0.0.1' && ip !== '::1') {
        try {
          const response = geoReader.city(ip);
          locationObj.country = response.country?.names?.en || 'Unknown';
          locationObj.city = response.city?.names?.en || 'Unknown';
        } catch (lookupError) {
          console.warn(`Could not resolve location for IP: ${ip}`);
        }
      }
    }

    const isWebhookBot = /bot|crawl|spider|yahoo|slurp|facebook|google|bing/i.test(userAgent || '');

    // 3. Process State Mutations based on eventType
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

      // Propagate bounce to all campaigns for this email
      const coreCamps = await Campaign.find({ 'recipients.email': cleanEmail });
      for (const c of coreCamps) {
        let changed = false;
        c.recipients?.forEach(r => {
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
        mc.recipients?.forEach(r => {
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
        { $inc: { bounceCount: 1 }, $set: { emailStatus: 'Bounced', status: 'inactive' } }
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
          error: payload.data.error?.message || payload.data.error || 'Bounced'
        }
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
        { $set: { status: 'active', emailStatus: 'Active' } }
      );
      await updateEmailTags(cleanEmail, 'Active', 'Active');

      await MailEvent.create({
        eventType: 'Open',
        email: cleanEmail,
        timestamp: payload.created_at || new Date(),
        campaignId: camp?._id,
        messageId: emailId,
        ipAddress: ip,
        userAgent,
        location: locationObj
      });

    } else if (eventType === 'email.clicked') {
      if (isWebhookBot) return res.status(200).send('Ignored bot click');

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
              clicks: (locData.clicks || 0) + 1
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
        { $set: { status: 'engaged', emailStatus: 'Active' } }
      );
      await updateEmailTags(cleanEmail, 'Active', 'Active');

      await MailEvent.create({
        eventType: 'Click',
        email: cleanEmail,
        timestamp: payload.created_at || new Date(),
        campaignId: camp?._id,
        messageId: emailId,
        linkClicked: url,
        ipAddress: ip,
        userAgent,
        location: locationObj
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
        messageId: emailId
      });
    }

    res.status(200).send('Webhook processed');
  } catch (err) {
    console.error('Resend Webhook Error:', err);
    res.status(500).send('Server Error');
  }
});


// Unsubscribe Handler
router.post('/unsubscribe', async (req, res) => {
  const { email, reason, campaignId, recipientId } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const cleanEmail = email.toLowerCase().trim();
    
    // Find lead details to get name
    const leadDoc = await Lead.findOne({ email: cleanEmail });
    const leadName = leadDoc ? leadDoc.name : '';

    // 1. Update Lead Status
    await Lead.updateMany(
      { email: cleanEmail }, 
      { $set: { unsubscribed: true, unsubscribeReason: reason || 'Opt-out', emailStatus: 'Unsubscribed', status: 'inactive' } }
    );

    // Sync to HolySheet
    const { syncUnsubscribeToSheet } = require('../services/holySheetService');
    await syncUnsubscribeToSheet({
      email: cleanEmail,
      name: leadName,
      campaignId: campaignId || 'N/A',
      reason: reason || 'Opt-out',
      unsubscribedAt: new Date()
    });

    const Campaign = require('../models/Campaign');
    const MailCampaign = require('../models/MailCampaign');
    const MailEvent = require('../models/MailEvent');

    // 2. Track MailEvent for Campaign if campaignId exists
    if (campaignId && campaignId !== 'undefined' && campaignId !== 'null') {
      await MailEvent.create({
        eventType: 'Unsubscribe',
        email: cleanEmail,
        timestamp: new Date(),
        campaignId: campaignId,
        metadata: { recipientId, reason }
      });

      // Update specific campaign recipient status
      let campaign = await MailCampaign.findById(campaignId);
      let isCore = false;
      if (!campaign) {
        campaign = await Campaign.findOne({ $or: [{ _id: campaignId.match(/^[0-9a-fA-F]{24}$/) ? campaignId : null }, { campaignId }] });
        isCore = true;
      }

      if (campaign) {
        const recipient = campaign.recipients?.id ? campaign.recipients.id(recipientId) : campaign.recipients?.find(r => r._id.toString() === recipientId.toString() || r.email === cleanEmail);
        if (recipient && recipient.status !== 'Unsubscribed') {
          recipient.status = 'Unsubscribed';
          if (!isCore) {
            campaign.stats.unsubscribed = (campaign.stats.unsubscribed || 0) + 1;
          }
          await campaign.save();
        }
      }
    }

    // 3. Mark this email as Unsubscribed in all other Campaign/MailCampaign recipients
    const camps = await Campaign.find({ 'recipients.email': new RegExp(`^${cleanEmail}$`, 'i') });
    for (const camp of camps) {
      let changed = false;
      camp.recipients.forEach(r => {
        if (r.email && r.email.toLowerCase() === cleanEmail && r.status !== 'Unsubscribed') {
          r.status = 'Unsubscribed';
          changed = true;
        }
      });
      if (changed) await camp.save();
    }

    const mailCamps = await MailCampaign.find({ 'recipients.email': new RegExp(`^${cleanEmail}$`, 'i') });
    for (const camp of mailCamps) {
      let changed = false;
      camp.recipients.forEach(r => {
        if (r.email && r.email.toLowerCase() === cleanEmail && r.status !== 'Unsubscribed') {
          r.status = 'Unsubscribed';
          changed = true;
        }
      });
      if (changed) {
        // Recalculate stats
        let uns = 0;
        camp.recipients.forEach(r => {
          if (r.status === 'Unsubscribed') uns++;
        });
        camp.stats.unsubscribed = uns;
        await camp.save();
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Unsubscribe error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
