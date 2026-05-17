const express = require('express');
const router = express.Router();
const geoip = require('geoip-lite');
const EmailLog = require('../models/EmailLog');
const Lead = require('../models/Lead');
const Campaign = require('../models/Campaign');

const parseClientNetworkLocation = (req) => {
  // In production, extract the first IP address from the x-forwarded-for header chain
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (ip && ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }

  // Handle local development network loops cleanly
  if (!ip || ip === '127.0.0.1' || ip === '::1') {
    return { city: 'Mumbai', country: 'IN', region: 'MH' }; // Mock target location for local testing
  }

  const geo = geoip.lookup(ip);
  return geo ? { city: geo.city || 'Unknown', country: geo.country } : { city: 'Unknown', country: 'Global' };
};

// Open Tracking Pixel Endpoint
router.get('/open/:pixelId.gif', async (req, res) => {
  try {
    const { pixelId } = req.params;
    const location = parseClientNetworkLocation(req);
    const city = location.city || 'Unknown';

    const log = await EmailLog.findOne({ pixelId });
    if (log && !log.opened) {
      await EmailLog.updateOne({ pixelId }, { $set: { opened: true } });
      await Lead.updateOne({ email: log.leadEmail }, { $set: { status: 'active', emailStatus: 'Active' } });
      
      await Campaign.updateOne(
        { campaignId: String(log.campaignId) },
        { 
          $inc: { 
            'metrics.opened': 1, 
            [`locationBreakdown.${city}.opens`]: 1 
          },
          $push: { timeSeries: { time: new Date(), opens: 1, clicks: 0 } }
        }
      );

      const MailCampaign = require('../models/MailCampaign');
      const MailEvent = require('../models/MailEvent');

      let camp = await Campaign.findOne({ $or: [{ campaignId: String(log.campaignId) }, { _id: log.campaignId.match(/^[0-9a-fA-F]{24}$/) ? log.campaignId : null }] });
      let isCore = true;
      if (!camp) {
        camp = await MailCampaign.findOne({ _id: log.campaignId.match(/^[0-9a-fA-F]{24}$/) ? log.campaignId : null });
        isCore = false;
      }

      if (camp) {
        await MailEvent.create({
          eventType: 'Open',
          email: log.leadEmail,
          timestamp: new Date(),
          campaignId: camp._id
        });

        if (camp.recipients) {
          const rec = camp.recipients.find(r => r.email && r.email.toLowerCase() === log.leadEmail.toLowerCase());
          if (rec && !['Clicked', 'Unsubscribed', 'Bounced'].includes(rec.status)) {
            rec.status = 'Opened';
            if (!isCore) {
              camp.stats.opened = (camp.stats.opened || 0) + 1;
            }
            await camp.save();
          }
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

    const log = await EmailLog.findOne({ clickId });
    if (log && !log.clicked) {
      await EmailLog.updateOne({ clickId }, { $set: { clicked: true } });
      await Lead.updateOne({ email: log.leadEmail }, { $set: { status: 'engaged', emailStatus: 'Active' } });

      await Campaign.updateOne(
        { campaignId: String(log.campaignId) },
        { 
          $inc: { 'metrics.clicked': 1, [`locationBreakdown.${city}.clicks`]: 1 },
          $push: { timeSeries: { time: new Date(), opens: 0, clicks: 1 } }
        }
      );

      const MailCampaign = require('../models/MailCampaign');
      const MailEvent = require('../models/MailEvent');

      let camp = await Campaign.findOne({ $or: [{ campaignId: String(log.campaignId) }, { _id: log.campaignId.match(/^[0-9a-fA-F]{24}$/) ? log.campaignId : null }] });
      let isCore = true;
      if (!camp) {
        camp = await MailCampaign.findOne({ _id: log.campaignId.match(/^[0-9a-fA-F]{24}$/) ? log.campaignId : null });
        isCore = false;
      }

      if (camp) {
        await MailEvent.create({
          eventType: 'Click',
          email: log.leadEmail,
          timestamp: new Date(),
          campaignId: camp._id,
          metadata: { url: destinationUrl }
        });

        if (camp.recipients) {
          const rec = camp.recipients.find(r => r.email && r.email.toLowerCase() === log.leadEmail.toLowerCase());
          if (rec && !['Unsubscribed', 'Bounced'].includes(rec.status)) {
            rec.status = 'Clicked';
            if (!isCore) {
              camp.stats.clicked = (camp.stats.clicked || 0) + 1;
            }
            await camp.save();
          }
        }
      }
    }

    const fallbackRedirect = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(302, destinationUrl ? decodeURIComponent(destinationUrl) : fallbackRedirect);
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
    try {
      const rawBodyStr = req.rawBody ? req.rawBody.toString('utf8') : '';
      
      // Fallback for Resend's custom header names
      const svixHeaders = {
        'svix-id': req.headers['svix-id'] || req.headers['resend-webhook-id'],
        'svix-timestamp': req.headers['svix-timestamp'] || req.headers['resend-webhook-timestamp'],
        'svix-signature': req.headers['svix-signature'] || req.headers['resend-signature'] || req.headers['resend-webhook-signature']
      };

      payload = wh.verify(rawBodyStr, svixHeaders);
    } catch (err) {
      console.error('Resend Webhook Signature Verification Failed:', err.message);
      return res.status(400).send('Invalid webhook signature');
    }

    if (!payload || !payload.type || !payload.data) {
      return res.status(400).send('Invalid payload');
    }

    const eventType = payload.type;
    const emailId = payload.data.email_id;
    if (!emailId) return res.status(200).send('No email_id');

    const MailEvent = require('../models/MailEvent');
    
    // Find campaign by recipient's messageId (which stores Resend's email_id)
    let camp = await Campaign.findOne({ 'recipients.messageId': emailId });
    let isCore = true;
    if (!camp) {
      const MailCampaign = require('../models/MailCampaign');
      camp = await MailCampaign.findOne({ 'recipients.messageId': emailId });
      isCore = false;
    }

    if (camp) {
      const recipient = camp.recipients.find(r => r.messageId === emailId);
      if (recipient) {
        let statusUpdated = false;
        
        if (eventType === 'email.delivered' && !['Opened', 'Clicked', 'Bounced'].includes(recipient.status)) {
          recipient.status = 'Sent';
          statusUpdated = true;
        } else if (eventType === 'email.opened' && !['Clicked', 'Bounced'].includes(recipient.status)) {
          recipient.status = 'Opened';
          if (!isCore) camp.stats.opened = (camp.stats.opened || 0) + 1;
          else camp.metrics.opened = (camp.metrics.opened || 0) + 1;
          statusUpdated = true;
          
          await Lead.updateOne({ _id: recipient.leadId || recipient.email }, { $set: { status: 'active', emailStatus: 'Active' } });
        } else if (eventType === 'email.clicked' && recipient.status !== 'Bounced') {
          recipient.status = 'Clicked';
          if (!isCore) camp.stats.clicked = (camp.stats.clicked || 0) + 1;
          else camp.metrics.clicked = (camp.metrics.clicked || 0) + 1;
          statusUpdated = true;
          
          await Lead.updateOne({ _id: recipient.leadId || recipient.email }, { $set: { status: 'engaged', emailStatus: 'Active' } });
        } else if (eventType === 'email.bounced') {
          recipient.status = 'Bounced';
          if (!isCore) camp.stats.bounced = (camp.stats.bounced || 0) + 1;
          else camp.metrics.bounced = (camp.metrics.bounced || 0) + 1;
          statusUpdated = true;
          
          await Lead.updateOne({ email: recipient.email }, { $inc: { bounceCount: 1 }, $set: { emailStatus: 'Bounced' } });
        }

        if (statusUpdated) {
          try { await camp.save(); } catch (e) {}
        }

        await MailEvent.create({
          eventType: eventType === 'email.opened' ? 'Open' : eventType === 'email.clicked' ? 'Click' : eventType === 'email.bounced' ? 'Bounce' : 'Delivery',
          email: recipient.email,
          timestamp: payload.created_at || new Date(),
          campaignId: camp._id,
          messageId: emailId
        });
      }
    }
    res.status(200).send('Webhook processed');
  } catch (err) {
    console.error('Resend Webhook Error:', err);
    res.status(500).send('Server Error');
  }
});


// Unsubscribe Handler
router.post('/unsubscribe', async (req, res) => {
  const { email, reason } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const cleanEmail = email.toLowerCase().trim();
    await Lead.updateMany(
      { email: cleanEmail }, 
      { $set: { unsubscribed: true, unsubscribeReason: reason || 'Opt-out', emailStatus: 'Unsubscribed', status: 'inactive' } }
    );

    const camps = await Campaign.find({ 'recipients.email': new RegExp(`^${cleanEmail}$`, 'i') });
    for (const camp of camps) {
      const rec = camp.recipients.find(r => r.email && r.email.toLowerCase() === cleanEmail);
      if (rec && rec.status !== 'Unsubscribed') {
        rec.status = 'Unsubscribed';
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
