const express = require('express');
const router = express.Router();
const MailCampaign = require('../models/MailCampaign');
const EmailProfile = require('../models/EmailProfile');
const MailEvent = require('../models/MailEvent');
const Lead = require('../models/Lead');
const { protect, admin } = require('../middleware/authMiddleware');
const { sendCampaign, scanBounces } = require('../services/mailService');

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
      stats: { total: allRecipients.length, sent: 0, opened: 0, clicked: 0, bounced: 0 },
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
    const totalCampaigns = await MailCampaign.countDocuments({ createdBy: req.user._id });
    const totalSent = await MailEvent.countDocuments({ eventType: 'Send' });
    const totalBounced = await MailEvent.countDocuments({ eventType: 'Bounce' });
    const totalOpened = await MailEvent.countDocuments({ eventType: 'Open' });

    res.json({ totalCampaigns, totalSent, totalBounced, totalOpened });
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
        if (recipient && recipient.status !== 'Opened') {
          recipient.status = 'Opened';
          campaign.stats.opened = (campaign.stats.opened || 0) + 1;
          await campaign.save();
        }
      }
    }

    // 3. Update master Lead data
    if (email) {
      const leads = await Lead.find({ email: email.toLowerCase().trim() });
      for (const lead of leads) {
        lead.metadata = { ...lead.metadata, emailStatus: 'Active', lastOpenedAt: new Date() };
        await lead.save();
      }
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

module.exports = router;
