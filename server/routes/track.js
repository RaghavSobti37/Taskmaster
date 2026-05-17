const express = require('express');
const router = express.Router();
const geoip = require('geoip-lite');
const EmailLog = require('../models/EmailLog');
const Lead = require('../models/Lead');
const Campaign = require('../models/Campaign');

const getClientIpAndGeo = (req) => {
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  if (ip && ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }

  if (ip === '127.0.0.1' || ip === '::1' || !ip) {
    const testPublicIp = '103.241.12.1'; // Mumbai, India
    return { ip: testPublicIp, geo: geoip.lookup(testPublicIp) || { city: 'Mumbai', country: 'IN' } };
  }

  return { ip, geo: geoip.lookup(ip) || { city: 'Unknown', country: 'Global' } };
};

// Pixel Tracker Route
router.get('/open/:pixelId.gif', async (req, res) => {
  try {
    const { pixelId } = req.params;
    const { geo } = getClientIpAndGeo(req);
    const city = geo.city || 'Unknown';

    const log = await EmailLog.findOne({ pixelId });
    if (log && !log.opened) {
      await EmailLog.updateOne({ pixelId }, { $set: { opened: true } });
      await Lead.updateOne({ email: log.leadEmail }, { $set: { status: 'active', emailStatus: 'Active' } });
      
      await Campaign.updateOne(
        { campaignId: log.campaignId },
        { 
          $inc: { 'metrics.opened': 1, [`locationBreakdown.${city}.opens`]: 1 },
          $push: { timeSeries: { time: new Date(), opens: 1, clicks: 0 } }
        }
      );

      const camp = await Campaign.findOne({ $or: [{ campaignId: log.campaignId }, { _id: log.campaignId.match(/^[0-9a-fA-F]{24}$/) ? log.campaignId : null }] });
      if (camp && camp.recipients) {
        const rec = camp.recipients.find(r => r.email && r.email.toLowerCase() === log.leadEmail.toLowerCase());
        if (rec && !['Clicked', 'Unsubscribed', 'Bounced'].includes(rec.status)) {
          rec.status = 'Opened';
          await camp.save();
        }
      }
    }

    const buffer = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.writeHead(200, {
      'Content-Type': 'image/gif',
      'Content-Length': buffer.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0, private',
      'Pragma': 'no-cache'
    });
    res.end(buffer);
  } catch (err) {
    console.error('Tracking Pixel Error:', err);
    res.status(500).end();
  }
});

// Click Tracking Redirect Wrapper
router.get('/click/:clickId', async (req, res) => {
  try {
    const { clickId } = req.params;
    const destinationUrl = req.query.redirect;
    const { geo } = getClientIpAndGeo(req);
    const city = geo.city || 'Unknown';

    const log = await EmailLog.findOne({ clickId });
    if (log && !log.clicked) {
      await EmailLog.updateOne({ clickId }, { $set: { clicked: true } });
      await Lead.updateOne({ email: log.leadEmail }, { $set: { status: 'engaged', emailStatus: 'Active' } });

      await Campaign.updateOne(
        { campaignId: log.campaignId },
        { 
          $inc: { 'metrics.clicked': 1, [`locationBreakdown.${city}.clicks`]: 1 },
          $push: { timeSeries: { time: new Date(), opens: 0, clicks: 1 } }
        }
      );

      const camp = await Campaign.findOne({ $or: [{ campaignId: log.campaignId }, { _id: log.campaignId.match(/^[0-9a-fA-F]{24}$/) ? log.campaignId : null }] });
      if (camp && camp.recipients) {
        const rec = camp.recipients.find(r => r.email && r.email.toLowerCase() === log.leadEmail.toLowerCase());
        if (rec && !['Unsubscribed', 'Bounced'].includes(rec.status)) {
          rec.status = 'Clicked';
          await camp.save();
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

// Automated Bounce Webhook Callback Handler
router.post('/webhooks/bounces', async (req, res) => {
  const { email, type } = req.body;

  if (type === 'bounce' && email) {
    try {
      const cleanEmail = email.toLowerCase().trim();
      const updatedLead = await Lead.findOneAndUpdate(
        { email: cleanEmail },
        { $inc: { bounceCount: 1 }, $set: { emailStatus: 'Bounced' } },
        { new: true, lean: true }
      );

      if (updatedLead && updatedLead.bounceCount >= 3) {
        await Lead.deleteOne({ email: updatedLead.email });
        await EmailLog.deleteMany({ leadEmail: updatedLead.email });
      } else if (updatedLead) {
        await Lead.updateOne({ email: updatedLead.email }, { $set: { status: 'inactive' } });
      }

      const camps = await Campaign.find({ 'recipients.email': new RegExp(`^${cleanEmail}$`, 'i') });
      for (const camp of camps) {
        const rec = camp.recipients.find(r => r.email && r.email.toLowerCase() === cleanEmail);
        if (rec && rec.status !== 'Bounced') {
          rec.status = 'Bounced';
          camp.metrics.bounced = (camp.metrics.bounced || 0) + 1;
          await camp.save();
        }
      }
    } catch (err) {
      console.error('Bounce webhook error:', err);
    }
  }
  res.status(200).send('Webhook processed');
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
