const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Campaign = require('../models/Campaign');
const MailCampaign = require('../models/MailCampaign');
const MailTemplate = require('../models/MailTemplate');
const Lead = require('../models/Lead');
const {
  getEffectiveTemplateContent,
  validateVariableMapping,
  leadToRowData,
} = require('../utils/indexedTemplateVariables');
const { migrateLegacyTemplates } = require('../utils/mailTemplateHelpers');
const { normalizeOutboundEmailHtml } = require('../utils/normalizeOutboundEmailHtml');
const { protect } = require('../middleware/authMiddleware');
const { dispatchCampaignJobs, stopCampaign } = require('../services/queueService');
const { computeRecipientStats } = require('../utils/campaignStats');
const { resolveCampaignByParam, isObjectIdHex } = require('../utils/resolveCampaign');
const { isAdminUser } = require('../utils/departmentPermissions');

const assertCampaignAccess = (campaign, user) => {
  if (!campaign) return false;
  if (isAdminUser(user)) return true;
  const ownerId = campaign.createdBy?._id || campaign.createdBy;
  return ownerId && String(ownerId) === String(user._id);
};
const {
  normalizeEmail,
  isValidEmail,
  filterRecipientsByStatus,
  annotateRecipient,
} = require('../utils/emailValidation');
const { resolveMailEventCityAsync, buildClickCityByEmail } = require('../utils/geoLookup');
const logger = require('../utils/logger');
const { validateBody } = require('../validation/validateBody');
const {
  createCampaignBody,
  resendCampaignBody,
  resendFilteredCampaignBody,
} = require('../validation/schemas/campaigns');

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
    const userId = req.user._id;
    const listPipeline = [
      { $match: { createdBy: userId } },
      { $addFields: { recipientCount: { $size: { $ifNull: ['$recipients', []] } } } },
      { $project: { content: 0, recipients: 0 } },
      { $sort: { createdAt: -1 } },
    ];
    const [coreCampaigns, mailCampaigns] = await Promise.all([
      Campaign.aggregate(listPipeline),
      MailCampaign.aggregate(listPipeline),
    ]);
    const allCampaigns = [...coreCampaigns, ...mailCampaigns].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    for (const camp of allCampaigns) {
      const stats = camp.stats || {};
      const metrics = camp.metrics || {};
      const targetTotal = Math.max(
        camp.recipientCount || 0,
        stats.total || 0,
        metrics.totalRecipients || 0,
      );
      camp.recipientCount = targetTotal;
      camp.stats = {
        total: targetTotal,
        sent: stats.sent ?? metrics.totalSent ?? 0,
        opened: stats.opened ?? metrics.opened ?? 0,
        clicked: stats.clicked ?? metrics.clicked ?? 0,
        bounced: stats.bounced ?? metrics.bounced ?? 0,
        unsubscribed: stats.unsubscribed ?? 0,
        invalid: stats.invalid ?? 0,
      };
      if (!camp.metrics) {
        camp.metrics = {
          totalSent: stats.sent ?? 0,
          opened: stats.opened ?? 0,
          clicked: stats.clicked ?? 0,
          bounced: stats.bounced ?? 0,
        };
      }
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

router.get('/:id/recipients', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const statusFilter = String(req.query.status || 'all').toLowerCase();
    const hideInvalid = req.query.hideInvalid === 'true';

    const resolved = await resolveCampaignByParam(req.params.id, { lean: true });
    if (!resolved || !assertCampaignAccess(resolved.campaign, req.user)) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    let recipients = (resolved.campaign.recipients || []).map((r) => annotateRecipient(
      typeof r.toObject === 'function' ? r.toObject() : r
    ));

    const invalidCount = recipients.filter((r) => r.invalidEmail).length;

    if (hideInvalid) {
      recipients = recipients.filter((r) => !r.invalidEmail);
    }

    recipients = filterRecipientsByStatus(recipients, statusFilter);

    const total = recipients.length;
    const pages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, pages);
    const start = (safePage - 1) * limit;
    const slice = recipients.slice(start, start + limit);

    res.json({
      recipients: slice,
      pagination: {
        page: safePage,
        limit,
        total,
        pages,
      },
      invalidCount,
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
    if (!resolved || !assertCampaignAccess(resolved.campaign, req.user)) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    let campaign = resolved.campaign;

    const computed = computeRecipientStats(campaign.recipients);
    campaign.recipientStatusCounts = computed.recipientStatusCounts;
    campaign.stats = computed.stats;
    campaign.metrics = computed.metrics;

    const ipCache = new Map();
    const eventQuery = { campaignId: campaign._id };
    const EVENT_STREAM_LIMIT = 100;

    const [recentEvents, geoEvents] = await Promise.all([
      MailEvent.find(eventQuery)
        .sort({ timestamp: -1 })
        .limit(EVENT_STREAM_LIMIT)
        .setOptions({ bypassTenant: true })
        .lean(),
      MailEvent.find({ ...eventQuery, eventType: { $in: ['Open', 'Click'] } })
        .select('eventType timestamp email ipAddress location metadata')
        .setOptions({ bypassTenant: true })
        .lean(),
    ]);

    const clickCityByEmail = await buildClickCityByEmail(geoEvents, ipCache);
    const cityByEventId = new Map();

    const inferLocationTrust = (evt, displayCity) => {
      if (evt.eventType === 'Click') return displayCity ? 'verified' : 'none';
      if (evt.eventType !== 'Open') return 'none';
      if (!displayCity) return 'none';
      const email = String(evt.email || '').toLowerCase().trim();
      const clickCity = clickCityByEmail.get(email);
      if (clickCity && clickCity === displayCity) return 'inferred';
      if (evt.location?.city) return 'verified';
      return 'proxy';
    };

    const resolveEventCityCached = async (evt) => {
      const key = String(evt._id);
      if (cityByEventId.has(key)) return cityByEventId.get(key);
      const city = await resolveMailEventCityAsync(evt, ipCache, clickCityByEmail);
      cityByEventId.set(key, city);
      return city;
    };

    campaign.events = await Promise.all(recentEvents.map(async (evt) => {
      const displayCity = await resolveEventCityCached(evt);
      return {
        ...evt,
        displayCity,
        locationTrust: inferLocationTrust(evt, displayCity),
      };
    }));

    const locationBreakdown = {};
    const timeSeriesMap = {};

    for (const evt of geoEvents) {
      const city = await resolveEventCityCached(evt);
      if (city) {
        const trust = inferLocationTrust(evt, city);
        if (evt.eventType === 'Open' && trust === 'proxy') {
          /* skip proxy opens in geo charts — clicks and inferred opens only */
        } else {
          if (!locationBreakdown[city]) locationBreakdown[city] = { opens: 0, clicks: 0 };
          if (evt.eventType === 'Open') locationBreakdown[city].opens++;
          else locationBreakdown[city].clicks++;
        }
      }

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
    
    campaign.locationBreakdown = locationBreakdown;
    campaign.timeSeries = Object.entries(timeSeriesMap)
      .map(([hourStr, data]) => ({
        time: data.time,
        opens: data.opens,
        clicks: data.clicks
      }))
      .sort((a, b) => new Date(a.time) - new Date(b.time));

    campaign.recipientCount = computed.total;
    campaign.invalidEmailCount = (campaign.recipients || []).filter((r) => !isValidEmail(r.email)).length;
    delete campaign.recipients;

    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', validateBody(createCampaignBody), async (req, res) => {
  try {
    const {
      title, subject, content, senderProfileId, senderMode, senderProfileIds,
      systemProvider, resendFromEmail, includeSignature, signature, attachments, eventTag, leadIds, customRecipients,
      removeUnsubscribe, variableFallbacks, mailTemplateId, variableMapping,
      action,
    } = req.body;
    const dispatchNow = action === 'dispatch';
    const campaignId = crypto.randomBytes(12).toString('hex');

    if (!mailTemplateId) {
      return res.status(400).json({ error: 'mailTemplateId is required — select an approved template' });
    }
    await migrateLegacyTemplates();
    const template = await MailTemplate.findById(mailTemplateId);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (template.status !== 'approved') {
      return res.status(400).json({ error: 'Only approved templates can be used for campaigns' });
    }

    const effectiveBody = getEffectiveTemplateContent(template);
    const templateContent = template.format === 'rawHtml'
      ? effectiveBody
      : normalizeOutboundEmailHtml(effectiveBody);
    const resolvedSubject = subject || template.subject || title;
    const mappingObj = variableMapping && typeof variableMapping === 'object' ? variableMapping : {};
    const mappingCheck = validateVariableMapping([templateContent, resolvedSubject], mappingObj);
    if (!mappingCheck.ok) {
      return res.status(400).json({
        error: `Map all template variables: ${mappingCheck.missing.map((i) => `{${i}}`).join(', ')}`,
      });
    }

    const toRowDataMap = (rowData) => {
      if (!rowData || typeof rowData !== 'object') return undefined;
      const m = new Map();
      for (const [k, v] of Object.entries(rowData)) {
        m.set(String(k).toLowerCase().trim(), v != null ? String(v) : '');
      }
      return m.size ? m : undefined;
    };

    const leads = leadIds && leadIds.length ? await Lead.find({ _id: { $in: leadIds }, unsubscribed: { $ne: true }, emailStatus: { $ne: 'Bounced' } }) : [];
    const buildRecipientRow = (row) => {
      const email = normalizeEmail(row.email);
      if (!email) return null;
      const base = {
        leadId: row.leadId,
        email,
        name: (row.name || '').trim(),
        rowData: toRowDataMap(row.rowData) || toRowDataMap(leadToRowData(row.leadDoc)),
      };
      if (!isValidEmail(email)) {
        return { ...base, status: 'Invalid', error: 'Invalid email address' };
      }
      return { ...base, status: 'Pending' };
    };

    const recipients = leads.map((l) => buildRecipientRow({
      leadId: l._id,
      email: l.email,
      name: l.name || '',
      leadDoc: l,
      rowData: leadToRowData(l),
    })).filter(Boolean);

    const custom = (Array.isArray(customRecipients) ? customRecipients : [])
      .map((r) => buildRecipientRow({
        email: r?.email,
        name: (r?.name || r?.firstName || '').trim(),
        rowData: r?.rowData,
      }))
      .filter(Boolean);

    const uniqueEmails = new Set();
    const allRecipients = [...recipients, ...custom].filter((r) => {
      if (uniqueEmails.has(r.email)) return false;
      uniqueEmails.add(r.email);
      return true;
    });

    const skippedInvalidCount = allRecipients.filter((r) => r.status === 'Invalid').length;

    const { isVerifiedResendEmail } = require('../utils/resendFromEmails');
    const mode = senderMode || 'single';
    if (mode === 'single' && !senderProfileId) {
      return res.status(400).json({ error: 'senderProfileId required for single sender mode' });
    }
    if (mode === 'pool' && (!senderProfileIds || senderProfileIds.length === 0)) {
      return res.status(400).json({ error: 'At least one profile required for pool mode' });
    }
    if (mode === 'system_resend') {
      const from = (resendFromEmail || '').trim().toLowerCase();
      if (!from || !isVerifiedResendEmail(from)) {
        return res.status(400).json({ error: 'resendFromEmail required — pick a @theshakticollective.in address' });
      }
    }

    const campaignPayload = {
      campaignId,
      title,
      subject: resolvedSubject,
      content: (template.format === 'rawHtml' || /<!DOCTYPE|<html[\s>]/i.test((content || templateContent || '').trim()))
        ? (content || templateContent)
        : normalizeOutboundEmailHtml(content || templateContent),
      mailTemplateId: template._id,
      variableMapping: mappingObj,
      senderProfileId: senderProfileId || undefined,
      senderMode: mode,
      senderProfileIds: senderProfileIds || [],
      includeSignature: includeSignature === true,
      signature: typeof signature === 'string' ? signature : '',
      removeUnsubscribe: removeUnsubscribe === true,
      attachments: (attachments || []).map((a) => ({
        filename: a.filename,
        contentType: a.contentType,
        storageKey: a.storageKey
      })),
      eventTag: eventTag || 'General',
      recipients: allRecipients,
      recipientCount: allRecipients.length,
      status: dispatchNow ? 'Queued' : 'Draft',
      metrics: { totalSent: 0, opened: 0, clicked: 0, bounced: 0 },
      createdBy: req.user._id
    };
    if (systemProvider === 'resend' || systemProvider === 'env_smtp') {
      campaignPayload.systemProvider = systemProvider;
    }
    if (mode === 'system_resend' && resendFromEmail) {
      campaignPayload.resendFromEmail = resendFromEmail.trim().toLowerCase();
    }
    if (variableFallbacks && typeof variableFallbacks === 'object') {
      campaignPayload.variableFallbacks = variableFallbacks;
    }

    const campaign = await Campaign.create(campaignPayload);

    let dispatchResult = null;
    const sendableCount = allRecipients.filter((r) => r.status === 'Pending').length;
    if (dispatchNow && sendableCount > 0) {
      dispatchResult = await dispatchCampaignJobs(campaign._id);
    }

    const campaignObj = campaign.toObject ? campaign.toObject() : campaign;
    res.status(201).json({
      ...campaignObj,
      skippedInvalidCount,
      dispatch: dispatchResult,
    });
  } catch (err) {
    console.error('Create campaign error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/dispatch', async (req, res) => {
  try {
    const resolved = await resolveCampaignByParam(req.params.id);
    if (!resolved || !assertCampaignAccess(resolved.campaign, req.user)) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const { campaign } = resolved;
    if (!resolved.isLegacy && campaign.status === 'Draft') {
      campaign.status = 'Queued';
      await campaign.save();
    }
    const result = await dispatchCampaignJobs(campaign._id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/resend', validateBody(resendCampaignBody), async (req, res) => {
  try {
    const {
      senderMode, senderProfileId, senderProfileIds, systemProvider, resendFromEmail,
      targetStatuses, includeSignature
    } = req.body;

    const resolved = await resolveCampaignByParam(req.params.id);
    if (!resolved || !assertCampaignAccess(resolved.campaign, req.user)) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

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
      if (resendFromEmail !== undefined) {
        const { isVerifiedResendEmail } = require('../utils/resendFromEmails');
        const from = (resendFromEmail || '').trim().toLowerCase();
        if (from && !isVerifiedResendEmail(from)) {
          return res.status(400).json({ error: 'resendFromEmail must be a @theshakticollective.in address' });
        }
        campaign.resendFromEmail = from || undefined;
      }

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

router.post('/:id/resend-filtered', validateBody(resendFilteredCampaignBody), async (req, res) => {
  try {
    const {
      recipientEmails,
      statusFilter,
      hideInvalid,
      filterLabel,
      titleOverride,
      senderMode,
      senderProfileId,
      senderProfileIds,
      systemProvider,
      resendFromEmail,
      includeSignature,
    } = req.body;

    const resolved = await resolveCampaignByParam(req.params.id);
    if (!resolved || !assertCampaignAccess(resolved.campaign, req.user)) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const source = resolved.campaign;

    let filteredRecipients = [];

    if (statusFilter && statusFilter !== 'all') {
      let pool = (source.recipients || []).map((r) => annotateRecipient(
        typeof r.toObject === 'function' ? r.toObject() : r
      ));
      if (hideInvalid) {
        pool = pool.filter((r) => !r.invalidEmail);
      }
      pool = filterRecipientsByStatus(pool, String(statusFilter).toLowerCase());
      filteredRecipients = pool
        .filter((r) => isValidEmail(r.email))
        .map((r) => ({
          leadId: r.leadId,
          email: normalizeEmail(r.email),
          name: r.name || '',
          status: 'Pending',
        }));
    } else if (Array.isArray(recipientEmails) && recipientEmails.length > 0) {
      const emailSet = new Set(recipientEmails.map((e) => normalizeEmail(e)).filter(Boolean));
      filteredRecipients = (source.recipients || [])
        .filter((r) => emailSet.has(normalizeEmail(r.email)))
        .filter((r) => isValidEmail(r.email))
        .map((r) => ({
          leadId: r.leadId,
          email: normalizeEmail(r.email),
          name: r.name || '',
          status: 'Pending',
        }));
    } else {
      return res.status(400).json({ error: 'recipientEmails or statusFilter required' });
    }

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
    const resolvedResendFrom = (resendFromEmail || source.resendFromEmail || '').trim().toLowerCase();
    if (mode === 'system_resend') {
      const { isVerifiedResendEmail } = require('../utils/resendFromEmails');
      if (!resolvedResendFrom || !isVerifiedResendEmail(resolvedResendFrom)) {
        return res.status(400).json({ error: 'resendFromEmail required — pick a @theshakticollective.in address' });
      }
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
    if (mode === 'system_resend' && resolvedResendFrom) {
      campaignPayload.resendFromEmail = resolvedResendFrom;
    }

    if (source.variableFallbacks) {
      campaignPayload.variableFallbacks = source.variableFallbacks;
    }
    if (source.mailTemplateId) campaignPayload.mailTemplateId = source.mailTemplateId;
    if (source.variableMapping) {
      campaignPayload.variableMapping = source.variableMapping instanceof Map
        ? Object.fromEntries(source.variableMapping.entries())
        : source.variableMapping;
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

router.post('/:id/stop', async (req, res) => {
  try {
    const resolved = await resolveCampaignByParam(req.params.id);
    if (!resolved || !assertCampaignAccess(resolved.campaign, req.user)) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const result = await stopCampaign(resolved.campaign._id);
    res.json(result);
  } catch (err) {
    const status = err.message?.includes('Cannot stop') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const MailEvent = require('../models/MailEvent');
    const EmailLog = require('../models/EmailLog');

    const resolved = await resolveCampaignByParam(req.params.id);
    if (!resolved || !assertCampaignAccess(resolved.campaign, req.user)) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const { campaign, Model } = resolved;
    const campId = campaign._id;
    const campaignTag = campaign.campaignId || String(campId);

    await Model.findByIdAndDelete(campId).setOptions({ bypassTenant: true });
    await EmailLog.deleteMany({ campaignId: { $in: [campaignTag, String(campId)] } });
    await MailEvent.deleteMany({ campaignId: campId }).setOptions({ bypassTenant: true });

    res.json({ success: true, message: 'Campaign and all associated tracking data deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
