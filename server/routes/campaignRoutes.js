const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Campaign = require('../models/Campaign');
const Lead = require('../models/Lead');
const { protect } = require('../middleware/authMiddleware');
const { dispatchCampaignJobs } = require('../services/queueService');

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const campaigns = await Campaign.find({ createdBy: req.user._id }).sort('-createdAt').lean();
    for (const camp of campaigns) {
      let total = camp.recipients?.length || 0;
      let sent = 0, opened = 0, clicked = 0, bounced = 0, unsubscribed = 0, invalid = 0;
      camp.recipients?.forEach(r => {
        if (['Sent', 'Opened', 'Clicked', 'Unsubscribed'].includes(r.status)) sent++;
        if (['Opened', 'Clicked'].includes(r.status)) { opened++; }
        if (r.status === 'Clicked') { clicked++; }
        if (['Bounced', 'Failed', 'Invalid'].includes(r.status)) bounced++;
        if (r.status === 'Invalid') { invalid++; }
        if (r.status === 'Unsubscribed') unsubscribed++;
      });
      camp.stats = { total, sent, opened, clicked, bounced, unsubscribed, invalid };
    }
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findOne({ $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { campaignId: id }] })
      .populate('recipients.leadId', 'name email location phone status artistType')
      .populate('senderProfileId')
      .lean();
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    
    let total = campaign.recipients?.length || 0;
    let sent = 0, opened = 0, clicked = 0, bounced = 0, unsubscribed = 0, invalid = 0;
    campaign.recipients?.forEach(r => {
      if (['Sent', 'Opened', 'Clicked', 'Unsubscribed'].includes(r.status)) sent++;
      if (['Opened', 'Clicked'].includes(r.status)) { opened++; }
      if (r.status === 'Clicked') { clicked++; }
      if (['Bounced', 'Failed', 'Invalid'].includes(r.status)) bounced++;
      if (r.status === 'Invalid') { invalid++; }
      if (r.status === 'Unsubscribed') unsubscribed++;
    });
    campaign.stats = { total, sent, opened, clicked, bounced, unsubscribed, invalid };

    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, subject, content, senderProfileId, eventTag, leadIds, customRecipients } = req.body;
    const campaignId = crypto.randomBytes(12).toString('hex');

    const leads = leadIds && leadIds.length ? await Lead.find({ _id: { $in: leadIds }, unsubscribed: { $ne: true }, emailStatus: { $ne: 'Bounced' } }) : [];
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

    const campaign = await Campaign.create({
      campaignId,
      title,
      subject,
      content,
      senderProfileId,
      eventTag: eventTag || 'General',
      recipients: allRecipients,
      metrics: { totalSent: 0, opened: 0, clicked: 0, bounced: 0 },
      createdBy: req.user._id
    });

    if (allRecipients.length > 0) {
      dispatchCampaignJobs(campaign._id);
    }

    res.status(201).json(campaign);
  } catch (err) {
    console.error('Create campaign error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/dispatch', async (req, res) => {
  try {
    const result = await dispatchCampaignJobs(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
