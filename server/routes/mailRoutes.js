const express = require('express');
const router = express.Router();
const MailCampaign = require('../models/MailCampaign');
const EmailProfile = require('../models/EmailProfile');
const MailEvent = require('../models/MailEvent');
const Lead = require('../models/Lead');
const { protect, admin } = require('../middleware/authMiddleware');
const { sendCampaign, scanBounces, updateEmailTags } = require('../services/mailService');

// --- PROFILES ---
router.get('/profiles', protect, async (req, res) => {
  try {
    const profiles = await EmailProfile.find({ createdBy: req.user._id }).lean();
    res.json(profiles);
  } catch (err) {
    console.error('Get profiles error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/profiles', protect, async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.smtpHost && data.smtpHost.toLowerCase().trim() === 'gmail') {
      data.smtpHost = 'smtp.gmail.com';
      data.smtpPort = 587;
    }
    const profile = await EmailProfile.create({ ...data, createdBy: req.user._id });
    res.json(profile);
  } catch (err) {
    console.error('Create profile error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/profiles/:id', protect, async (req, res) => {
  try {
    await EmailProfile.findByIdAndDelete(req.params.id);
    res.json({ message: 'Profile deleted' });
  } catch (err) {
    console.error('Delete profile error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- CAMPAIGNS ---
router.get('/campaigns', protect, async (req, res) => {
  try {
    const campaigns = await MailCampaign.find({ createdBy: req.user._id }).sort('-createdAt').lean();
    for (const camp of campaigns) {
      let total = camp.recipients?.length || 0;
      let sent = 0, opened = 0, clicked = 0, bounced = 0, unsubscribed = 0, invalid = 0;
      camp.recipients?.forEach(r => {
        if (r.status === 'Sent') sent++;
        if (r.status === 'Opened') { sent++; opened++; }
        if (r.status === 'Clicked') { sent++; opened++; clicked++; }
        if (r.status === 'Bounced' || r.status === 'Failed') bounced++;
        if (r.status === 'Invalid') { bounced++; invalid++; }
        if (r.status === 'Unsubscribed') unsubscribed++;
      });
      camp.stats = { total, sent, opened, clicked, bounced, unsubscribed, invalid };
    }
    res.json(campaigns);
  } catch (err) {
    console.error('Get campaigns error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/campaigns', protect, async (req, res) => {
  try {
    const { leadIds, customRecipients, ...rest } = req.body;
    const mongoose = require('mongoose');
    const validLeadIds = Array.isArray(leadIds) ? leadIds.filter(id => mongoose.Types.ObjectId.isValid(id)) : [];
    const leads = validLeadIds.length ? await Lead.find({ _id: { $in: validLeadIds } }) : [];
    
    const recipients = leads.map(l => ({
      leadId: l._id,
      email: l.email ? l.email.toLowerCase().trim() : '',
      status: 'Pending'
    })).filter(r => r.email);

    const custom = (Array.isArray(customRecipients) ? customRecipients : []).map(r => ({
      email: r && r.email ? String(r.email).toLowerCase().trim() : '',
      status: 'Pending'
    })).filter(r => r.email);

    const allRecipients = [...recipients, ...custom];

    const campaign = await MailCampaign.create({
      ...rest,
      recipients: allRecipients,
      stats: { total: allRecipients.length, sent: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0, invalid: 0 },
      createdBy: req.user._id
    });
    res.json(campaign);
  } catch (err) {
    console.error('Create campaign error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/campaigns/:id/send', protect, async (req, res) => {
  try {
    sendCampaign(req.params.id); // Run in background
    res.json({ message: 'Campaign dispatch started' });
  } catch (err) {
    console.error('Send campaign error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- EVENTS & ANALYTICS ---
router.get('/stats', protect, async (req, res) => {
  try {
    const campaigns = await MailCampaign.find({ createdBy: req.user._id }).lean();
    let totalCampaigns = campaigns.length;
    let totalSent = 0, totalOpened = 0, totalClicked = 0, totalBounced = 0, totalUnsubscribed = 0;
    campaigns.forEach(camp => {
      camp.recipients?.forEach(r => {
        if (['Sent', 'Opened', 'Clicked', 'Unsubscribed'].includes(r.status)) totalSent++;
        if (['Opened', 'Clicked'].includes(r.status)) totalOpened++;
        if (r.status === 'Clicked') totalClicked++;
        if (['Bounced', 'Failed', 'Invalid'].includes(r.status)) totalBounced++;
        if (r.status === 'Unsubscribed') totalUnsubscribed++;
      });
    });

    res.json({ totalCampaigns, totalSent, totalBounced, totalOpened, totalClicked, totalUnsubscribed });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- BOUNCE SCAN ---
router.post('/scan-bounces', protect, async (req, res) => {
  const { profileId } = req.body;
  try {
    const bounced = await scanBounces(profileId);
    res.json({ success: true, count: bounced.length, emails: bounced });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- EMAIL TRACKING (Public endpoint) ---
router.get('/track/:campaignId/:recipientId', async (req, res) => {
  const { campaignId, recipientId } = req.params;
  const { email } = req.query;

  try {
    // 1. Record Open event
    await MailEvent.create({
      eventType: 'Open',
      email: email || 'unknown',
      timestamp: new Date(),
      campaignId: campaignId !== 'undefined' ? campaignId : null,
      metadata: { recipientId }
    });

    // 2. Update campaign recipient status and stats
    if (campaignId && campaignId !== 'undefined') {
      const campaign = await MailCampaign.findById(campaignId);
      if (campaign) {
        const recipient = campaign.recipients.id(recipientId) || campaign.recipients.find(r => r.email === email);
        if (recipient && recipient.status !== 'Opened' && recipient.status !== 'Clicked') {
          recipient.status = 'Opened';
          campaign.stats.opened = (campaign.stats.opened || 0) + 1;
          await campaign.save();
        }
      }
    }

    // 3. Update master Lead & Tsc data
    if (email) {
      await updateEmailTags(email, 'Active', 'Active');
    }
  } catch (err) {
    console.error('Tracking Error:', err);
  }

  // Send 1x1 transparent GIF
  const buf = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': buf.length,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.end(buf);
});

// --- CLICK TRACKING (Public endpoint) ---
router.get('/click/:campaignId/:recipientId', async (req, res) => {
  const { campaignId, recipientId } = req.params;
  const { email, url } = req.query;
  const targetUrl = url && url !== '#' && url !== 'undefined' ? url : 'https://theshakticollective.in';

  try {
    // 1. Record Click event
    await MailEvent.create({
      eventType: 'Click',
      email: email || 'unknown',
      timestamp: new Date(),
      campaignId: campaignId !== 'undefined' ? campaignId : null,
      metadata: { recipientId, url: targetUrl }
    });

    // 2. Update campaign recipient status and stats
    if (campaignId && campaignId !== 'undefined') {
      const campaign = await MailCampaign.findById(campaignId);
      if (campaign) {
        const recipient = campaign.recipients.id(recipientId) || campaign.recipients.find(r => r.email === email);
        if (recipient && recipient.status !== 'Clicked') {
          recipient.status = 'Clicked';
          campaign.stats.clicked = (campaign.stats.clicked || 0) + 1;
          await campaign.save();
        }
      }
    }

    // 3. Update master Lead & Tsc data
    if (email) {
      await updateEmailTags(email, 'Active', 'Active');
    }
  } catch (err) {
    console.error('Click Tracking Error:', err);
  }

  res.redirect(targetUrl);
});

// --- UNSUBSCRIBE (Public endpoint) ---
router.get('/unsubscribe/:campaignId/:recipientId', async (req, res) => {
  const { campaignId, recipientId } = req.params;
  const { email } = req.query;

  try {
    if (email) {
      await MailEvent.create({
        eventType: 'Unsubscribe',
        email: email,
        timestamp: new Date(),
        campaignId: campaignId !== 'undefined' ? campaignId : null,
        metadata: { recipientId }
      });

      await updateEmailTags(email, 'unsubscribed', 'Unsubscribed');
    }

    if (campaignId && campaignId !== 'undefined') {
      const campaign = await MailCampaign.findById(campaignId);
      if (campaign) {
        const recipient = campaign.recipients.id(recipientId) || campaign.recipients.find(r => r.email === email);
        if (recipient && recipient.status !== 'Unsubscribed') {
          recipient.status = 'Unsubscribed';
          campaign.stats.unsubscribed = (campaign.stats.unsubscribed || 0) + 1;
          await campaign.save();
        }
      }
    }
  } catch (err) {
    console.error('Unsubscribe Error:', err);
  }

  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Unsubscribed Successfully</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f1f5f9; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
    .card { background-color: #1e293b; padding: 40px 30px; border-radius: 20px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); max-width: 420px; width: 90%; border: 1px solid #334155; }
    h1 { color: #38bdf8; font-size: 24px; margin-bottom: 16px; font-weight: 800; }
    p { color: #94a3b8; font-size: 15px; line-height: 1.6; margin-bottom: 24px; }
    .icon { width: 64px; height: 64px; background: rgba(56, 189, 248, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; color: #38bdf8; font-size: 32px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h1>Unsubscribed</h1>
    <p>You have been successfully unsubscribed from our mailing list. Your preferences have been instantly updated across our ecosystem.</p>
  </div>
</body>
</html>`);
});

module.exports = router;
