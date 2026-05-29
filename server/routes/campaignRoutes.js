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
const { computeRecipientStats } = require('../utils/campaignStats');
const { resolveCampaignByParam, isObjectIdHex } = require('../utils/resolveCampaign');
const { resolveMailEventCityAsync, buildClickCityByEmail } = require('../utils/geoLookup');
const logger = require('../utils/logger');

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
      const computed = computeRecipientStats(camp.recipients);
      camp.recipientStatusCounts = computed.recipientStatusCounts;
      camp.stats = computed.stats;
      camp.metrics = computed.metrics;
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

    const resolved = await resolveCampaignByParam(id, { populate: true, lean: true });
    if (!resolved) return res.status(404).json({ error: 'Campaign not found' });
    let campaign = resolved.campaign;

    const computed = computeRecipientStats(campaign.recipients);
    campaign.recipientStatusCounts = computed.recipientStatusCounts;
    campaign.stats = computed.stats;
    campaign.metrics = computed.metrics;

    const ipCache = new Map();
    const eventQuery = { campaignId: campaign._id };
    const allEvents = await MailEvent.find(eventQuery).setOptions({ bypassTenant: true }).lean();

    const clickCityByEmail = await buildClickCityByEmail(allEvents, ipCache);
    const resolveEventCity = (evt) => resolveMailEventCityAsync(evt, ipCache, clickCityByEmail);

    const eventsRaw = allEvents.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 100);
    campaign.events = await Promise.all(eventsRaw.map(async (evt) => ({
      ...evt,
      displayCity: await resolveEventCity(evt),
    })));
    
    const locationBreakdown = {};
    const timeSeriesMap = {};
    
    for (const evt of allEvents) {
      if (evt.eventType === 'Open' || evt.eventType === 'Click') {
        const city = await resolveEventCity(evt);
        if (city) {
          if (!locationBreakdown[city]) locationBreakdown[city] = { opens: 0, clicks: 0 };
          if (evt.eventType === 'Open') locationBreakdown[city].opens++;
          else locationBreakdown[city].clicks++;
        }
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
    }
    
    campaign.locationBreakdown = locationBreakdown;
    campaign.timeSeries = Object.entries(timeSeriesMap)
      .map(([hourStr, data]) => ({
        time: data.time,
        opens: data.opens,
        clicks: data.clicks
      }))
      .sort((a, b) => new Date(a.time) - new Date(b.time));

    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      title, subject, content, senderProfileId, senderMode, senderProfileIds,
      systemProvider, includeSignature, attachments, eventTag, leadIds, customRecipients,
      removeUnsubscribe, variableFallbacks,
    } = req.body;
    const campaignId = crypto.randomBytes(12).toString('hex');

    const leads = leadIds && leadIds.length ? await Lead.find({ _id: { $in: leadIds }, unsubscribed: { $ne: true }, emailStatus: { $ne: 'Bounced' } }) : [];
    const recipients = leads.map(l => ({
      leadId: l._id,
      email: l.email ? l.email.toLowerCase().trim() : '',
      name: l.name || '',
      status: 'Pending'
    })).filter(r => r.email);

    const custom = (Array.isArray(customRecipients) ? customRecipients : []).map(r => ({
      email: r && r.email ? String(r.email).toLowerCase().trim() : '',
      name: (r?.name || r?.firstName || '').trim(),
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

    const campaignPayload = {
      campaignId,
      title,
      subject,
      content,
      senderProfileId: senderProfileId || undefined,
      senderMode: mode,
      senderProfileIds: senderProfileIds || [],
      includeSignature: includeSignature !== false,
      removeUnsubscribe: removeUnsubscribe === true,
      attachments: (attachments || []).map((a) => ({
        filename: a.filename,
        contentType: a.contentType,
        storageKey: a.storageKey
      })),
      eventTag: eventTag || 'General',
      recipients: allRecipients,
      metrics: { totalSent: 0, opened: 0, clicked: 0, bounced: 0 },
      createdBy: req.user._id
    };
    if (systemProvider === 'resend' || systemProvider === 'env_smtp') {
      campaignPayload.systemProvider = systemProvider;
    }
    if (variableFallbacks && typeof variableFallbacks === 'object') {
      campaignPayload.variableFallbacks = variableFallbacks;
    }

    const campaign = await Campaign.create(campaignPayload);

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
    const resolved = await resolveCampaignByParam(req.params.id);
    if (!resolved) return res.status(404).json({ error: 'Campaign not found' });
    const result = await dispatchCampaignJobs(resolved.campaign._id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/resend', async (req, res) => {
  try {
    const {
      senderMode, senderProfileId, senderProfileIds, systemProvider,
      targetStatuses, includeSignature
    } = req.body;

    const resolved = await resolveCampaignByParam(req.params.id);
    if (!resolved) return res.status(404).json({ error: 'Campaign not found' });

    let campaign = resolved.campaign;
    const isCore = !resolved.isLegacy;

    const defaultTargets = ['Failed', 'Bounced', 'Pending', 'Invalid'];
    const statuses = Array.isArray(targetStatuses) && targetStatuses.length
      ? targetStatuses
      : defaultTargets;

    if (isCore) {
      if (senderMode) campaign.senderMode = senderMode;
      if (senderProfileId !== undefined) campaign.senderProfileId = senderProfileId || undefined;
      if (senderProfileIds !== undefined) campaign.senderProfileIds = senderProfileIds || [];
      if (systemProvider === 'resend' || systemProvider === 'env_smtp') {
        campaign.systemProvider = systemProvider;
      } else if (senderMode && senderMode !== 'system_resend' && senderMode !== 'system_smtp') {
        campaign.set('systemProvider', undefined);
      }
      if (includeSignature !== undefined) campaign.includeSignature = includeSignature;

      const mode = campaign.senderMode || 'single';
      if (mode === 'single' && !campaign.senderProfileId && senderProfileId === undefined) {
        return res.status(400).json({ error: 'senderProfileId required for single sender mode' });
      }
      if (mode === 'pool' && (!campaign.senderProfileIds || campaign.senderProfileIds.length === 0)) {
        return res.status(400).json({ error: 'At least one profile required for pool mode' });
      }
    } else if (senderProfileId) {
      campaign.senderProfileId = senderProfileId;
    }

    let resetCount = 0;
    for (const rec of campaign.recipients || []) {
      if (statuses.includes(rec.status)) {
        rec.status = 'Pending';
        rec.sentAt = undefined;
        rec.messageId = undefined;
        rec.error = undefined;
        resetCount++;
      }
    }

    if (resetCount === 0) {
      return res.status(400).json({
        error: 'No recipients match the selected statuses',
        recipientStatusCounts: statuses
      });
    }

    const remainingAfter = (campaign.recipients || []).filter(
      (r) => r.status === 'Pending' || r.status === 'Queued'
    ).length;

    campaign.status = 'Sending';
    await campaign.save();

    const result = await dispatchCampaignJobs(campaign._id);
    res.json({
      ...result,
      resetCount,
      remainingToSend: remainingAfter,
      targetStatuses: statuses,
      senderMode: campaign.senderMode || 'single'
    });
  } catch (err) {
    console.error('Resend campaign error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/resend-filtered', async (req, res) => {
  try {
    const {
      recipientEmails,
      filterLabel,
      titleOverride,
      senderMode,
      senderProfileId,
      senderProfileIds,
      systemProvider,
      includeSignature,
    } = req.body;

    if (!Array.isArray(recipientEmails) || recipientEmails.length === 0) {
      return res.status(400).json({ error: 'recipientEmails required' });
    }

    const resolved = await resolveCampaignByParam(req.params.id);
    if (!resolved) return res.status(404).json({ error: 'Campaign not found' });
    const source = resolved.campaign;

    const emailSet = new Set(recipientEmails.map((e) => String(e).toLowerCase().trim()).filter(Boolean));
    const filteredRecipients = (source.recipients || [])
      .filter((r) => emailSet.has((r.email || '').toLowerCase().trim()))
      .map((r) => ({
        leadId: r.leadId,
        email: (r.email || '').toLowerCase().trim(),
        name: r.name || '',
        status: 'Pending',
      }));

    if (filteredRecipients.length === 0) {
      return res.status(400).json({ error: 'No matching recipients found in source campaign' });
    }

    const label = (filterLabel || 'Filtered').trim();
    const newTitle = (titleOverride || `${source.title} [${label}]`).trim();
    const mode = senderMode || source.senderMode || 'single';
    const resolvedProfileId = senderProfileId
      || (source.senderProfileId?._id || source.senderProfileId);
    const resolvedProfileIds = senderProfileIds?.length
      ? senderProfileIds
      : (source.senderProfileIds || []).map((p) => p._id || p);

    if (mode === 'single' && !resolvedProfileId) {
      return res.status(400).json({ error: 'senderProfileId required for single sender mode' });
    }
    if (mode === 'pool' && (!resolvedProfileIds || resolvedProfileIds.length === 0)) {
      return res.status(400).json({ error: 'At least one profile required for pool mode' });
    }

    const campaignId = crypto.randomBytes(12).toString('hex');
    const campaignPayload = {
      campaignId,
      title: newTitle,
      subject: source.subject,
      content: source.content,
      senderProfileId: mode === 'single' ? resolvedProfileId : resolvedProfileId || undefined,
      senderMode: mode,
      senderProfileIds: mode === 'pool' ? resolvedProfileIds : [],
      includeSignature: includeSignature !== undefined ? includeSignature !== false : source.includeSignature !== false,
      removeUnsubscribe: source.removeUnsubscribe === true,
      attachments: (source.attachments || []).map((a) => ({
        filename: a.filename,
        contentType: a.contentType,
        storageKey: a.storageKey,
      })),
      eventTag: source.eventTag || 'General',
      recipients: filteredRecipients,
      metrics: { totalSent: 0, opened: 0, clicked: 0, bounced: 0 },
      createdBy: req.user._id,
    };

    if (systemProvider === 'resend' || systemProvider === 'env_smtp') {
      campaignPayload.systemProvider = systemProvider;
    } else if (source.systemProvider && (mode === 'system_resend' || mode === 'system_smtp')) {
      campaignPayload.systemProvider = source.systemProvider;
    }

    if (source.variableFallbacks) {
      campaignPayload.variableFallbacks = source.variableFallbacks;
    }

    const campaign = await Campaign.create(campaignPayload);
    const result = await dispatchCampaignJobs(campaign._id);

    const campaignObj = campaign.toObject ? campaign.toObject() : campaign;

    res.status(201).json({
      ...result,
      campaign: campaignObj,
      campaignId: campaign.campaignId,
      campaignMongoId: String(campaign._id),
      title: campaign.title,
      queuedCount: filteredRecipients.length,
      filterLabel: label,
    });
  } catch (err) {
    console.error('Resend filtered campaign error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const MailEvent = require('../models/MailEvent');
    const EmailLog = require('../models/EmailLog');

    const campaign = await Campaign.findOne({
      ...(isObjectIdHex(id) ? { $or: [{ campaignId: id }, { _id: id }] } : { campaignId: id }),
    });
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
