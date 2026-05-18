const express = require('express');
const router = express.Router();

// GET route to handle Meta Webhook Verification handshake
router.get('/instagram', (req, res) => {
  const mode = req.query['hub.mode'] || req.query.hub?.mode;
  const token = req.query['hub.verify_token'] || req.query.hub?.verify_token;
  const challenge = req.query['hub.challenge'] || req.query.hub?.challenge;

  const expectedToken = (process.env.META_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || 'verify_tsc').replace(/['"]/g, '').trim();
  const receivedToken = (token || '').replace(/['"]/g, '').trim();
  const receivedMode = (mode || '').trim();

  console.log('⚡ Received webhook verification request token:', receivedToken, 'Expected:', expectedToken, 'Mode:', receivedMode, 'Query:', JSON.stringify(req.query));

  if (receivedMode === 'subscribe' && receivedToken === expectedToken) {
    console.log('✅ Handshake validated successfully. Sending challenge code back.');
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(challenge);
  } else {
    console.error('❌ Meta Webhook Token Validation Failed.', { receivedMode, receivedToken, expectedToken });
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
router.post('/resend', async (req, res) => {
  try {
    const { type, data } = req.body;
    if (!type || !data) {
      return res.status(400).send('INVALID_PAYLOAD');
    }

    const email = Array.isArray(data.to) ? data.to[0] : (data.to || data.email);
    if (!email) {
      return res.status(200).send('NO_EMAIL_FOUND');
    }

    const cleanEmail = email.toLowerCase().trim();
    const MailCampaign = require('../models/MailCampaign');
    const MailEvent = require('../models/MailEvent');
    const { updateEmailTags } = require('../services/mailService');

    console.log(`⚡ [Resend Webhook] Event received: ${type} for ${cleanEmail}`);

    if (type === 'email.bounced' || type === 'email.complained') {
      await MailEvent.create({
        eventType: 'Bounce',
        email: cleanEmail,
        timestamp: new Date(),
        metadata: { source: 'RESEND_WEBHOOK', type, error: data.error || data.reason || 'Bounced' }
      });

      await updateEmailTags(cleanEmail, 'Invalid', 'Invalid');

      const campaigns = await MailCampaign.find({ 'recipients.email': cleanEmail });
      for (const camp of campaigns) {
        let modified = false;
        camp.recipients?.forEach(r => {
          if (r.email === cleanEmail && r.status !== 'Bounced' && r.status !== 'Invalid') {
            r.status = 'Bounced';
            r.error = data.error?.message || 'Bounced via webhook';
            modified = true;
          }
        });
        if (modified) {
          camp.stats.bounced = (camp.stats.bounced || 0) + 1;
          await camp.save();
        }
      }
    } else if (type === 'email.clicked') {
      await MailEvent.create({
        eventType: 'Click',
        email: cleanEmail,
        timestamp: new Date(),
        metadata: { source: 'RESEND_WEBHOOK', url: data.click?.url || data.url || '' }
      });

      await updateEmailTags(cleanEmail, 'Active', 'Active');

      const campaigns = await MailCampaign.find({ 'recipients.email': cleanEmail });
      for (const camp of campaigns) {
        let modified = false;
        camp.recipients?.forEach(r => {
          if (r.email === cleanEmail && r.status !== 'Clicked') {
            r.status = 'Clicked';
            modified = true;
          }
        });
        if (modified) {
          camp.stats.clicked = (camp.stats.clicked || 0) + 1;
          await camp.save();
        }
      }
    } else if (type === 'email.opened') {
      await MailEvent.create({
        eventType: 'Open',
        email: cleanEmail,
        timestamp: new Date(),
        metadata: { source: 'RESEND_WEBHOOK' }
      });

      await updateEmailTags(cleanEmail, 'Active', 'Active');

      const campaigns = await MailCampaign.find({ 'recipients.email': cleanEmail });
      for (const camp of campaigns) {
        let modified = false;
        camp.recipients?.forEach(r => {
          if (r.email === cleanEmail && r.status !== 'Opened' && r.status !== 'Clicked') {
            r.status = 'Opened';
            modified = true;
          }
        });
        if (modified) {
          camp.stats.opened = (camp.stats.opened || 0) + 1;
          await camp.save();
        }
      }
    } else if (type === 'email.delivered') {
      const campaigns = await MailCampaign.find({ 'recipients.email': cleanEmail });
      for (const camp of campaigns) {
        let modified = false;
        camp.recipients?.forEach(r => {
          if (r.email === cleanEmail && r.status === 'Pending') {
            r.status = 'Sent';
            modified = true;
          }
        });
        if (modified) {
          await camp.save();
        }
      }
    }

    res.status(200).send('SUCCESS');
  } catch (err) {
    console.error('Error in Resend webhook processing:', err);
    res.status(500).send('SERVER_ERROR');
  }
});

module.exports = router;
