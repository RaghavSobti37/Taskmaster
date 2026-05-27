const express = require('express');
const router = express.Router();
const { handleBookedCall } = require('../controllers/webhookController');

router.post('/book-call', handleBookedCall);

// GET route to handle Meta Webhook Verification handshake
router.get('/instagram', (req, res) => {
  const mode = req.query['hub.mode'] || req.query.hub?.mode;
  const token = req.query['hub.verify_token'] || req.query.hub?.verify_token;
  const challenge = req.query['hub.challenge'] || req.query.hub?.challenge;

  const expectedToken = (process.env.META_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || '').replace(/['"]/g, '').trim();
  const receivedToken = (token || '').replace(/['"]/g, '').trim();
  const receivedMode = (mode || '').trim();

  console.log('⚡ Received webhook verification request. Mode:', receivedMode);

  if (receivedMode === 'subscribe' && expectedToken && receivedToken === expectedToken) {
    console.log('✅ Handshake validated successfully. Sending challenge code back.');
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(challenge);
  } else {
    console.error('❌ Meta Webhook Token Validation Failed.', { receivedMode });
    return res.status(403).send('Validation Failed');
  }
});

const crypto = require('crypto');

// POST route to handle real-time Instagram mentions and events
router.post('/instagram', (req, res) => {
  try {
    const signatureHeader = req.headers['x-hub-signature-256'];
    if (signatureHeader && req.rawBody && process.env.META_APP_SECRET) {
      const hmac = crypto.createHmac('sha256', process.env.META_APP_SECRET);
      const digest = 'sha256=' + hmac.update(req.rawBody).digest('hex');
      if (digest !== signatureHeader) {
        console.warn('❌ [Meta Webhook] Signature mismatch! Expected:', digest, 'Received:', signatureHeader);
      } else {
        console.log('🔒 [Meta Webhook] SHA256 payload signature verified successfully.');
      }
    }

    const body = req.body;
    if (body && body.object === 'instagram') {
      body.entry?.forEach(entry => {
        entry.changes?.forEach(change => {
          if (change.field === 'mentions') {
            console.log('⚡ [Webhook] Mention received for media_id:', change.value?.media_id, 'Comment ID:', change.value?.comment_id);
          } else if (change.field === 'comments') {
            console.log('💬 [Webhook] Comment received on media:', change.value?.media_id, 'Text:', change.value?.text);
          } else if (change.field === 'messages') {
            console.log('✉️ [Webhook] Message received from sender:', change.value?.sender?.id);
          }
        });
      });
    }
    res.status(200).send('EVENT_RECEIVED');
  } catch (err) {
    console.error('Error in Meta webhook event processing:', err);
    res.status(500).send('SERVER_ERROR');
  }
});

// POST route to handle real-time Resend webhooks (Bounces, Clicks, Opens, Delivered)
// POST route to handle real-time Resend webhooks (Bounces, Clicks, Opens, Delivered)
router.post('/resend', async (req, res) => {
  try {
    // SECURITY: Authenticate Resend Webhook via Svix Signatures
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
          'svix-signature': svix_signature
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
    const Campaign = require('../models/Campaign');
    const MailCampaign = require('../models/MailCampaign');
    const MailEvent = require('../models/MailEvent');
    const Lead = require('../models/Lead');
    const { updateEmailTags } = require('../services/mailService');
    const geoip = require('geoip-lite');

    console.log(`⚡ [Resend Webhook API] Processing event: ${eventType} for ${cleanEmail} (Email ID: ${emailId || 'N/A'})`);

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

      // Strip ::ffff: prefix if present (IPv4-mapped IPv6 address)
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
        userAgent
      };
      locationString = `${locationObj.city}, ${locationObj.region}, ${locationObj.country}`;
    }

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
              clicks: locData.clicks || 0
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
        { $set: { status: 'active', emailStatus: 'Active' } }
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
          userAgent: locationObj.userAgent
        }
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
        metadata: {
          url,
          ip: locationObj.ip,
          location: locationString,
          city: locationObj.city,
          region: locationObj.region,
          country: locationObj.country,
          userAgent: locationObj.userAgent
        }
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

    res.status(200).send('SUCCESS');
  } catch (err) {
    console.error('Error in Resend webhook processing:', err);
    res.status(500).send('SERVER_ERROR');
  }
});

module.exports = router;
