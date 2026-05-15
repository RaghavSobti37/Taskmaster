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
  const profiles = await EmailProfile.find({ createdBy: req.user._id });
  res.json(profiles);
});

router.post('/profiles', protect, async (req, res) => {
  const profile = await EmailProfile.create({ ...req.body, createdBy: req.user._id });
  res.json(profile);
});

router.delete('/profiles/:id', protect, async (req, res) => {
  await EmailProfile.findByIdAndDelete(req.params.id);
  res.json({ message: 'Profile deleted' });
});

// --- CAMPAIGNS ---
router.get('/campaigns', protect, async (req, res) => {
  const campaigns = await MailCampaign.find({ createdBy: req.user._id }).sort('-createdAt');
  res.json(campaigns);
});

router.post('/campaigns', protect, async (req, res) => {
  const { leadIds, ...rest } = req.body;
  const leads = await Lead.find({ _id: { $in: leadIds } });
  
  const recipients = leads.map(l => ({
    leadId: l._id,
    email: l.email,
    status: 'Pending'
  }));

  const campaign = await MailCampaign.create({
    ...rest,
    recipients,
    stats: { total: recipients.length },
    createdBy: req.user._id
  });
  res.json(campaign);
});

router.post('/campaigns/:id/send', protect, async (req, res) => {
  sendCampaign(req.params.id); // Run in background
  res.json({ message: 'Campaign dispatch started' });
});

// --- EVENTS & ANALYTICS ---
router.get('/stats', protect, async (req, res) => {
  const totalCampaigns = await MailCampaign.countDocuments({ createdBy: req.user._id });
  const totalSent = await MailEvent.countDocuments({ eventType: 'Send' });
  const totalBounced = await MailEvent.countDocuments({ eventType: 'Bounce' });
  const totalOpened = await MailEvent.countDocuments({ eventType: 'Open' });

  res.json({ totalCampaigns, totalSent, totalBounced, totalOpened });
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

module.exports = router;
