const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Campaign = require('../models/Campaign');
const MailCampaign = require('../models/MailCampaign');
const Lead = require('../models/Lead');
const { protect } = require('../middleware/authMiddleware');
const { dispatchCampaignJobs } = require('../services/queueService');

router.use(protect);

const attachmentDir = path.join(__dirname, '../uploads/campaign-attachments');
if (!fs.existsSync(attachmentDir)) fs.mkdirSync(attachmentDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: attachmentDir,
    filename: (_req, file, cb) => {
      cb(null, `${crypto.randomBytes(16).toString('hex')}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.get('/', async (req, res) => {
  try {
    const coreCampaigns = await Campaign.find({ createdBy: req.user._id }).sort('-createdAt').lean();
    const mailCampaigns = await MailCampaign.find({ createdBy: req.user._id }).sort('-createdAt').lean();
    const allCampaigns = [...coreCampaigns, ...mailCampaigns].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    for (const camp of allCampaigns) {
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
    res.json(allCampaigns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/upload-attachment', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({
      filename: req.file.originalname,
      contentType: req.file.mimetype,
      storageKey: req.file.filename
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const MailEvent = require('../models/MailEvent');
    let campaign = await Campaign.findOne({ $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { campaignId: id }] })
      .populate('recipients.leadId', 'name email location phone status artistType')
      .populate('senderProfileId')
      .lean();
    
    if (!campaign && id.match(/^[0-9a-fA-F]{24}$/)) {
      campaign = await MailCampaign.findById(id)
        .populate('recipients.leadId', 'name email location phone status artistType')
        .populate('senderProfileId')
        .lean();
    }
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

    const events = await MailEvent.find({ campaignId: campaign._id }).sort({ timestamp: -1 }).limit(100).lean();
    campaign.events = events;

    const allEvents = await MailEvent.find({ campaignId: campaign._id }).lean();
    
    const locationBreakdown = {};
    const timeSeriesMap = {};
    
    allEvents.forEach(evt => {
      let city = 'Unknown';
      if (evt.metadata) {
        if (evt.metadata.city) {
          city = evt.metadata.city;
        } else if (evt.metadata.location) {
          city = evt.metadata.location.split(',')[0].trim();
        }
      }
      if (city === 'Unknown City' || city === 'Unknown Location') {
        city = 'Unknown';
      }
      
      if (!locationBreakdown[city]) {
        locationBreakdown[city] = { opens: 0, clicks: 0 };
      }
      if (evt.eventType === 'Open') {
        locationBreakdown[city].opens++;
      } else if (evt.eventType === 'Click') {
        locationBreakdown[city].clicks++;
      }
      
      if (evt.eventType === 'Open' || evt.eventType === 'Click') {
        const date = new Date(evt.timestamp);
        const hourStr = `${String(date.getHours()).padStart(2, '0')}:00`;
        if (!timeSeriesMap[hourStr]) {
          timeSeriesMap[hourStr] = { time: date, opens: 0, clicks: 0 };
        }
        if (evt.eventType === 'Open') {
          timeSeriesMap[hourStr].opens++;
        } else if (evt.eventType === 'Click') {
          timeSeriesMap[hourStr].clicks++;
        }
      }
    });
    
    campaign.locationBreakdown = locationBreakdown;
    campaign.timeSeries = Object.entries(timeSeriesMap)
      .map(([hourStr, data]) => ({
        time: data.time,
        opens: data.opens,
        clicks: data.clicks
      }))
      .sort((a, b) => new Date(a.time) - new Date(b.time));

    const statsObj = campaign.stats || { total, sent, opened, clicked, bounced, unsubscribed, invalid };
    campaign.metrics = {
      totalSent: statsObj.sent || 0,
      opened: statsObj.opened || 0,
      clicked: statsObj.clicked || 0,
      bounced: statsObj.bounced || 0
    };

    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      title, subject, content, senderProfileId, senderMode, senderProfileIds,
      systemProvider, includeSignature, attachments, eventTag, leadIds, customRecipients
    } = req.body;
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

    const uniqueEmails = new Set();
    const allRecipients = [...recipients, ...custom].filter(r => {
      if (uniqueEmails.has(r.email)) return false;
      uniqueEmails.add(r.email);
      return true;
    });

    const mode = senderMode || 'single';
    if (mode === 'single' && !senderProfileId) {
      return res.status(400).json({ error: 'senderProfileId required for single sender mode' });
    }
    if (mode === 'pool' && (!senderProfileIds || senderProfileIds.length === 0)) {
      return res.status(400).json({ error: 'At least one profile required for pool mode' });
    }

    const campaign = await Campaign.create({
      campaignId,
      title,
      subject,
      content,
      senderProfileId: senderProfileId || undefined,
      senderMode: mode,
      senderProfileIds: senderProfileIds || [],
      systemProvider: systemProvider || null,
      includeSignature: includeSignature !== false,
      attachments: (attachments || []).map((a) => ({
        filename: a.filename,
        contentType: a.contentType,
        storageKey: a.storageKey
      })),
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

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const MailEvent = require('../models/MailEvent');
    const EmailLog = require('../models/EmailLog');

    const campaign = await Campaign.findOne({ $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { campaignId: id }] });
    if (campaign) {
      await Campaign.findByIdAndDelete(campaign._id);
      await EmailLog.deleteMany({ campaignId: { $in: [String(campaign.campaignId), String(campaign._id)] } });
      await MailEvent.deleteMany({ campaignId: campaign._id });
    }

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      const mailCamp = await MailCampaign.findById(id);
      if (mailCamp) {
        await MailCampaign.findByIdAndDelete(id);
        await EmailLog.deleteMany({ campaignId: id });
        await MailEvent.deleteMany({ campaignId: id });
      }
    }

    res.json({ success: true, message: 'Campaign and all associated tracking data deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
