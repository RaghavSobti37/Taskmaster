const crypto = require('crypto');
const Campaign = require('../models/Campaign');
const MailCampaign = require('../models/MailCampaign');
const MailTemplate = require('../models/MailTemplate');
const MailEvent = require('../models/MailEvent');
const EmailLog = require('../models/EmailLog');
const Lead = require('../../../models/Lead');
const {
  getEffectiveTemplateContent,
  validateVariableMapping,
  leadToRowData,
} = require('../../../utils/indexedTemplateVariables');
const { migrateLegacyTemplates } = require('../../../utils/mailTemplateHelpers');
const { normalizeOutboundEmailHtml } = require('../../../utils/normalizeOutboundEmailHtml');
const { dispatchCampaignJobs, stopCampaign } = require('../../../services/queueService');
const { computeRecipientStats, aggregateRecipientStats } = require('../../../utils/campaignStats');
const { resolveCampaignByParam } = require('../campaignFacade');

/** Any authenticated user with emails page access can view and manage all org campaigns. */
const assertCampaignAccess = (campaign, user) => Boolean(campaign && user);

/** Avoid multi-MB JSON responses that timeout Vercel → Render proxy on large campaigns. */
const slimCampaignForResponse = (campaign) => {
  const obj = campaign?.toObject ? campaign.toObject() : { ...campaign };
  delete obj.recipients;
  delete obj.content;
  return obj;
};
const {
  normalizeEmail,
  isValidEmail,
  filterRecipientsByStatus,
  annotateRecipient,
} = require('../../../utils/emailValidation');
const { buildRegisteredLocationBreakdown } = require('../../../utils/campaignRegisteredLocation');
const {
  filterCampaignRecipients,
  resolveRecipientExportFields,
  recipientsToCsv,
  buildRecipientExportFilename,
} = require('../../../utils/campaignRecipientExport');

exports.list = async (req, res) => {
  try {
    const listPipeline = [
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
};

exports.uploadAttachment = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { uploadSingleMulterFile } = require('../../../utils/uploadthingServer');
    const uploaded = await uploadSingleMulterFile(req.file);
    res.json({
      filename: uploaded.name || req.file.originalname,
      contentType: uploaded.type || req.file.mimetype,
      storageKey: uploaded.key,
      storageUrl: uploaded.url,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getRecipients = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const statusFilter = String(req.query.status || 'all').toLowerCase();
    const hideInvalid = req.query.hideInvalid === 'true';

    const resolved = await resolveCampaignByParam(req.params.id, { lean: true });
    if (!resolved || !assertCampaignAccess(resolved.campaign, req.user)) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const { recipients, invalidCount } = filterCampaignRecipients(resolved.campaign.recipients, {
      statusFilter,
      hideInvalid,
    });

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
};

exports.exportRecipients = async (req, res) => {
  try {
    const statusFilter = String(req.query.status || 'all').toLowerCase();
    const hideInvalid = req.query.hideInvalid === 'true';

    const resolved = await resolveCampaignByParam(req.params.id, { lean: true });
    if (!resolved || !assertCampaignAccess(resolved.campaign, req.user)) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const { recipients } = filterCampaignRecipients(resolved.campaign.recipients, {
      statusFilter,
      hideInvalid,
    });

    const leadIds = [...new Set(recipients.map((r) => r.leadId).filter(Boolean))];
    const leads = leadIds.length
      ? await Lead.find({ _id: { $in: leadIds } }).select('name email phone').lean()
      : [];
    const leadMap = new Map(leads.map((l) => [String(l._id), l]));

    const rows = recipients.map((recipient) => {
      const leadDoc = recipient.leadId ? leadMap.get(String(recipient.leadId)) : null;
      return resolveRecipientExportFields(recipient, leadDoc);
    });

    const filename = buildRecipientExportFilename(resolved.campaign.title, statusFilter);
    const csv = recipientsToCsv(rows);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const aggregateTimeSeriesByHour = (points = []) => {
  const map = {};
  for (const pt of points) {
    if (!pt?.time) continue;
    const date = new Date(pt.time);
    if (Number.isNaN(date.getTime())) continue;
    const hourStr = `${String(date.getHours()).padStart(2, '0')}:00`;
    if (!map[hourStr]) map[hourStr] = { time: date, opens: 0, clicks: 0 };
    map[hourStr].opens += Number(pt.opens) || 0;
    map[hourStr].clicks += Number(pt.clicks) || 0;
  }
  return Object.values(map).sort((a, b) => new Date(a.time) - new Date(b.time));
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    const resolved = await resolveCampaignByParam(id, { populate: true, lean: true, excludeRecipients: true });
    if (!resolved || !assertCampaignAccess(resolved.campaign, req.user)) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const { Model } = resolved;
    let campaign = resolved.campaign;

    const computed = await aggregateRecipientStats(Model, campaign._id);
    campaign.recipientStatusCounts = computed.recipientStatusCounts;
    campaign.stats = computed.stats;
    campaign.metrics = computed.metrics;

    const storedTimeSeries = aggregateTimeSeriesByHour(campaign.timeSeries || []);
    const recipientCount = Math.max(campaign.recipientCount || 0, computed.total);

    if (storedTimeSeries.length > 0) campaign.timeSeries = storedTimeSeries;

    campaign.recipientCount = recipientCount;
    campaign.invalidEmailCount = computed.recipientStatusCounts.Invalid || 0;
    delete campaign.recipients;

    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const { id } = req.params;

    const resolved = await resolveCampaignByParam(id, { lean: true, excludeRecipients: true });
    if (!resolved || !assertCampaignAccess(resolved.campaign, req.user)) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const campaign = resolved.campaign;
    const storedTimeSeries = aggregateTimeSeriesByHour(campaign.timeSeries || []);

    const registered = await buildRegisteredLocationBreakdown(campaign._id, []);
    const timeSeries = registered.timeSeries.length > 0
      ? registered.timeSeries
      : storedTimeSeries;

    res.json({
      timeSeries,
      locationBreakdown: registered.locationBreakdown,
      locationBreakdownRows: registered.locationBreakdownRows,
      locationCoverage: registered.locationCoverage,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const {
      title, subject, content, senderProfileId, senderMode, senderProfileIds,
      systemProvider, resendFromEmail, emailStreamSlug, includeSignature, signature, attachments, eventTag, leadIds, customRecipients,
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

    const { isVerifiedResendEmail } = require('../../../utils/resendFromEmails');
    const { validateFromEmailForStream } = require('../../../services/emailStreamService');
    const mode = senderMode || 'single';
    if (mode === 'single' && !senderProfileId) {
      return res.status(400).json({ error: 'senderProfileId required for single sender mode' });
    }
    if (mode === 'pool' && (!senderProfileIds || senderProfileIds.length === 0)) {
      return res.status(400).json({ error: 'At least one profile required for pool mode' });
    }
    let resolvedStreamSlug = (emailStreamSlug || '').trim().toLowerCase() || null;
    if (mode === 'system_resend') {
      const from = (resendFromEmail || '').trim().toLowerCase();
      const streamCheck = await validateFromEmailForStream(from, resolvedStreamSlug);
      if (!streamCheck.ok) {
        return res.status(400).json({ error: streamCheck.error || 'Invalid from address for stream' });
      }
      resolvedStreamSlug = streamCheck.streamSlug || streamCheck.stream?.slug || resolvedStreamSlug;
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
        storageKey: a.storageKey,
        storageUrl: a.storageUrl,
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
    if (mode === 'system_resend' && resolvedStreamSlug) {
      campaignPayload.emailStreamSlug = resolvedStreamSlug;
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

    res.status(201).json({
      ...slimCampaignForResponse(campaign),
      skippedInvalidCount,
      dispatch: dispatchResult,
    });
  } catch (err) {
    console.error('Create campaign error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.dispatch = async (req, res) => {
  try {
    const resolved = await resolveCampaignByParam(req.params.id, { excludeRecipients: true });
    if (!resolved || !assertCampaignAccess(resolved.campaign, req.user)) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    const { campaign, Model } = resolved;
    if (!resolved.isLegacy && campaign.status === 'Draft') {
      const { bypassOptions } = require('../../../infrastructure/database/bypassTenantPolicy');
      await Model.updateOne(
        { _id: campaign._id },
        { $set: { status: 'Queued' } },
      ).setOptions(bypassOptions('CAMPAIGN_DISPATCH'));
    }
    const result = await dispatchCampaignJobs(campaign._id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.resend = async (req, res) => {
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
        const { isVerifiedResendEmail } = require('../../../utils/resendFromEmails');
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
};

exports.resendFiltered = async (req, res) => {
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
      const { isVerifiedResendEmail } = require('../../../utils/resendFromEmails');
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
        storageUrl: a.storageUrl,
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

    res.status(201).json({
      ...result,
      campaign: slimCampaignForResponse(campaign),
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
};

exports.stop = async (req, res) => {
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
};

exports.remove = async (req, res) => {
  try {
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
};
