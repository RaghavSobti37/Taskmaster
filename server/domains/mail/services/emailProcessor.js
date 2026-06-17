const logger = require('../../../utils/logger');
const mongoose = require('mongoose');
const { bypassOptions } = require('../../../infrastructure/database/bypassTenantPolicy');
const { resolveCampaignTenantId } = require('../../../utils/resolveCampaignTenantId');
const { getTenantId, runWithWorkerTenant } = require('../../../utils/workerTenantContext');

const BYPASS = bypassOptions('EMAIL_PROCESSOR');
const { buildFinalEmailHtml, personalizeEmailContent } = require('../../../utils/buildFinalEmailHtml');
const { stripUnsubscribe } = require('../../../utils/emailContentUtils');
const { incrementProfileSendCount, incrementProviderSendCount, resolvePoolProfile, resolveRotationProvider, usesSmtpRotation, getProfileRotationProviders } = require('../../../services/profileSendStats');
const { SMTP_PRESETS } = require('../../../utils/smtpPresets');
const { isAuthError, isRetryableSmtpError } = require('../../../utils/envProviderCredentials');
const { ENV_CONFIG } = require('../../../config/environment');
const { buildProfileTransporter, buildEnvTransporter, resolveMailTransport, sendViaTransport } = require('../../../utils/smtpTransport');
const { resolveTrackingApiBaseUrl } = require('../../../utils/trackingUrls');
const resolveTrackingBaseUrl = () => resolveTrackingApiBaseUrl();

const CAMPAIGN_PROCESS_FIELDS = [
  'status', 'subject', 'title', 'content', 'senderMode', 'senderProfileId',
  'senderProfileIds', 'systemProvider', 'resendFromEmail', 'includeSignature',
  'signature', 'removeUnsubscribe', 'variableMapping', 'variableFallbacks',
  'mailTemplateId', 'attachments', 'campaignId', 'tenantId', 'createdBy',
].join(' ');

const fetchSingleRecipient = async (Model, campaignId, recipientId) => {
  const rows = await Model.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(String(campaignId)) } },
    { $unwind: '$recipients' },
    { $match: { 'recipients._id': new mongoose.Types.ObjectId(String(recipientId)) } },
    { $replaceRoot: { newRoot: '$recipients' } },
    { $limit: 1 },
  ]);
  return rows[0] || null;
};

const updateRecipientFields = async (Model, campaignId, recipientId, fields, inc = null) => {
  const $set = {};
  for (const [k, v] of Object.entries(fields)) {
    $set[`recipients.$[elem].${k}`] = v;
  }
  const update = { $set };
  if (inc) update.$inc = inc;
  await Model.findByIdAndUpdate(
    campaignId,
    update,
    { arrayFilters: [{ 'elem._id': recipientId }], ...BYPASS },
  );
};

const incrementCampaignCounter = async (Model, campaignId, isLegacy, legacyField, coreField) => {
  if (isLegacy) {
    await Model.findByIdAndUpdate(campaignId, { $inc: { [`stats.${legacyField}`]: 1 } }, BYPASS);
  } else {
    await Model.findByIdAndUpdate(campaignId, { $inc: { [`metrics.${coreField}`]: 1 } }, BYPASS);
  }
};

const buildTransporter = (profile, providerKey = null) => buildProfileTransporter(profile, providerKey);

const buildEnvSmtpTransporter = () => buildEnvTransporter();

const logCampaignEvent = async (MailEvent, { eventType, email, campaignId, metadata, senderProfileId, rotationProvider, tenantId }) => {
  try {
    if (!tenantId) return;
    await MailEvent.create({
      eventType,
      email,
      timestamp: new Date(),
      campaignId,
      tenantId,
      metadata: metadata || undefined,
      senderProfileId: senderProfileId || undefined,
      rotationProvider: rotationProvider || undefined,
    });
  } catch (e) {
    logger.warn('Email Processor', 'Failed to log mail event', { eventType, error: e.message });
  }
};

const {
  loadCampaignAttachments,
  formatResendAttachments,
  formatNodemailerAttachments,
} = require('../../../utils/campaignAttachments');

const resolveSender = async (campaign, profileId, jobIndex) => {
  const EmailProfile = require('../models/EmailProfile');
  const { resend } = require('./mailDriver');
  const mode = campaign.senderMode || 'single';

  if (mode === 'system_resend') {
    if (!resend) {
      throw new Error('RESEND_API_KEY not configured. Cannot use System Resend sender mode.');
    }
    const { resolveResendFromEmail, displayNameForResendEmail } = require('../../../utils/resendFromEmails');
    const linked = campaign.senderProfileId && typeof campaign.senderProfileId === 'object'
      ? campaign.senderProfileId
      : null;
    const fromEmail = resolveResendFromEmail(campaign);
    return {
      profile: {
        name: linked?.name || displayNameForResendEmail(fromEmail),
        email: fromEmail,
        signature: campaign.signature || linked?.signature || '',
      },
      useResend: !!resend,
      transporter: null,
      profileIdForStats: null
    };
  }

  if (mode === 'system_smtp') {
    const transporter = buildEnvSmtpTransporter();
    if (!transporter) {
      throw new Error('System SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in server/.env');
    }
    const fromEmail = process.env.SYSTEM_VERIFIED_FROM_EMAIL || ENV_CONFIG.smtp?.user || 'system@coreknot.internal';
    return {
      profile: {
        name: 'System SMTP',
        email: fromEmail,
        signature: campaign.senderProfileId?.signature || ''
      },
      useResend: false,
      transporter,
      profileIdForStats: null
    };
  }

  if (mode === 'pool' && campaign.senderProfileIds?.length) {
    const poolIds = campaign.senderProfileIds.map((id) => (id._id || id).toString());
    const poolResult = await resolvePoolProfile(poolIds, jobIndex || 0);
    if (!poolResult) throw new Error('All SMTP profiles in pool have reached their daily send limit');
    const { profile: poolProfile, providerKey } = poolResult;
    const poolTransporter = buildTransporter(poolProfile, providerKey);
    if (!poolTransporter) {
      throw new Error(`SMTP profile "${poolProfile.name}" could not build transporter for rotation.`);
    }
    return {
      profile: poolProfile,
      useResend: false,
      transporter: poolTransporter,
      profileIdForStats: poolProfile._id,
      rotationProvider: providerKey,
    };
  }

  const profile = campaign.senderProfileId
    || (profileId ? await EmailProfile.findById(profileId) : null)
    || { name: 'Coreknot Core Engine', email: 'system@coreknot.internal', smtpHost: 'mock_smtp_host' };

  const { resend: globalResend } = require('./mailDriver');
  const useResend = !!globalResend && !usesSmtpRotation(profile);

  let rotationProvider = null;
  let transporter = null;

  if (usesSmtpRotation(profile) && profile._id) {
    rotationProvider = await resolveRotationProvider(profile, jobIndex || 0);
    if (!rotationProvider) {
      throw new Error(`All free SMTP servers have reached their daily limit for profile "${profile.name}". Resets at midnight UTC.`);
    }
    transporter = buildTransporter(profile, rotationProvider);
    if (!transporter) {
      throw new Error(`Could not build SMTP transporter for ${rotationProvider}.`);
    }
  } else {
    transporter = !useResend ? buildTransporter(profile) : null;
  }

  if (!useResend && !transporter && profile.smtpHost !== 'mock_smtp_host') {
    throw new Error(
      `SMTP profile "${profile.name || profile.email}" has invalid host "${profile.smtpHost || ''}". ` +
      'Enable SMTP rotation or set a valid host like smtp.gmail.com.'
    );
  }

  return {
    profile,
    useResend,
    transporter,
    profileIdForStats: profile._id || null,
    rotationProvider,
  };
};

const processEmailJobInner = async ({
  campaignId, recipientId, email, subject, content, profileId, isLegacy, jobIndex, tenantId,
}) => {
  const Campaign = require('../models/Campaign');
  const MailCampaign = require('../models/MailCampaign');
  const MailEvent = require('../models/MailEvent');
  const { isCampaignStopped } = require('./campaignQueueState');

  let Model = Campaign;
  let campaign = await Campaign.findById(campaignId)
    .select(CAMPAIGN_PROCESS_FIELDS)
    .populate('senderProfileId')
    .populate('senderProfileIds')
    .setOptions(BYPASS)
    .lean();
  if (!campaign) {
    campaign = await MailCampaign.findById(campaignId)
      .select(CAMPAIGN_PROCESS_FIELDS)
      .populate('senderProfileId')
      .setOptions(BYPASS)
      .lean();
    Model = MailCampaign;
    isLegacy = true;
  }
  if (!campaign) return;

  let recipientDoc = recipientId
    ? await fetchSingleRecipient(Model, campaignId, recipientId)
    : null;
  if (!recipientDoc && email) {
    const rows = await Model.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(String(campaignId)) } },
      { $unwind: '$recipients' },
      { $match: { 'recipients.email': String(email).toLowerCase() } },
      { $replaceRoot: { newRoot: '$recipients' } },
      { $limit: 1 },
    ]);
    recipientDoc = rows[0] || null;
  }

  const resolvedTenantId = tenantId || getTenantId() || await resolveCampaignTenantId(campaign);
  const logEvent = (payload) => logCampaignEvent(MailEvent, { ...payload, tenantId: resolvedTenantId });

  const getRecipient = () => recipientDoc;

  const skipRecipientAsCancelled = async (reason) => {
    const recipient = getRecipient();
    if (recipient && (recipient.status === 'Pending' || recipient.status === 'Queued')) {
      await updateRecipientFields(Model, campaign._id, recipient._id, {
        status: 'Cancelled',
        error: reason,
      });
    }
    await checkCompletion();
  };

  const { countPendingRecipients } = require('../../../utils/campaignStats');

  const checkCompletion = async () => {
    const freshStatus = await Model.findById(campaignId).select('status').setOptions(BYPASS).lean();
    if (!freshStatus || freshStatus.status === 'Stopped') return;
    const pending = await countPendingRecipients(Model, campaignId);
    if (pending === 0) {
      await Model.findByIdAndUpdate(campaignId, { $set: { status: 'Completed' } }, BYPASS);
    }
  };

  const freshCamp = await Model.findById(campaignId).select('status').lean();
  if (freshCamp?.status === 'Stopped' || isCampaignStopped(campaignId)) {
    logger.info('Email Processor', `Skipping send — campaign ${campaignId} is stopped`);
    await skipRecipientAsCancelled('Campaign stopped');
    return;
  }

  const Lead = require('../../../models/Lead');
  const { isValidEmail, normalizeEmail } = require('../../../utils/emailValidation');
  const cleanEmail = normalizeEmail(email);

  if (!isValidEmail(cleanEmail)) {
    logger.info('Email Processor', `Skipping invalid recipient format: ${email}`);
    const recipient = getRecipient();
    if (recipient) {
      await updateRecipientFields(Model, campaign._id, recipient._id, {
        status: 'Invalid',
        error: 'Invalid email address',
      });
    }
    await logEvent({
      eventType: 'Skipped',
      email: cleanEmail || String(email || ''),
      campaignId: campaign._id,
      metadata: { reason: 'Invalid email address', status: 'Invalid' },
    });
    await checkCompletion();
    return;
  }

  const leadDoc = await Lead.findOne({ email: cleanEmail });
  if (leadDoc && (leadDoc.unsubscribed === true || leadDoc.emailStatus === 'Unsubscribed' || leadDoc.emailStatus === 'Bounced' || leadDoc.emailStatus === 'Invalid')) {
    logger.info('Queue Service', `Skipping bad/unsubscribed recipient: ${email}`);
    const skipStatus = (leadDoc.emailStatus === 'Unsubscribed' || leadDoc.unsubscribed === true) ? 'Unsubscribed' : 'Bounced';
    const skipError = 'Unsubscribed or Bounced recipient';
    const recipient = getRecipient();
    if (recipient) {
      await updateRecipientFields(Model, campaign._id, recipient._id, {
        status: skipStatus,
        error: skipError,
      });
    }
    if (isLegacy) {
      const legacyField = skipStatus === 'Unsubscribed' ? 'unsubscribed' : 'bounced';
      await incrementCampaignCounter(Model, campaign._id, true, legacyField, legacyField);
    } else if (leadDoc.emailStatus === 'Bounced' || leadDoc.emailStatus === 'Invalid') {
      await incrementCampaignCounter(Model, campaign._id, false, 'bounced', 'bounced');
    }
    await logEvent({
      eventType: skipStatus === 'Unsubscribed' ? 'Skipped' : 'Failed',
      email: cleanEmail,
      campaignId: campaign._id,
      metadata: { reason: skipError, status: skipStatus },
    });
    await checkCompletion();
    return;
  }

  let sender;
  try {
    sender = await resolveSender(campaign, profileId, jobIndex);
  } catch (err) {
    const recipient = getRecipient();
    if (recipient) {
      await updateRecipientFields(Model, campaign._id, recipient._id, {
        status: 'Failed',
        error: err.message,
      });
    }
    await logEvent({
      eventType: 'Failed',
      email: cleanEmail,
      campaignId: campaign._id,
      metadata: { error: err.message, stage: 'resolveSender' },
    });
    await checkCompletion();
    throw err;
  }

  const { profile, useResend, transporter, profileIdForStats, rotationProvider } = sender;
  const { resend } = require('./mailDriver');
  let usedRotationProvider = rotationProvider;

  const baseUrl = resolveTrackingBaseUrl();

  const recipient = getRecipient();
  const shouldIncludeSignature = campaign.includeSignature === true;
  let baseHtml = content || campaign.content || '';
  if (campaign.removeUnsubscribe) {
    baseHtml = stripUnsubscribe(baseHtml);
  }

  const variableMapping = campaign.variableMapping instanceof Map
    ? Object.fromEntries(campaign.variableMapping.entries())
    : (campaign.variableMapping || {});
  const fallbacks = campaign.variableFallbacks instanceof Map
    ? Object.fromEntries(campaign.variableFallbacks.entries())
    : (campaign.variableFallbacks || {});

  const { html: htmlContent, subject: mergedSubject } = personalizeEmailContent({
    html: baseHtml,
    subject: subject || campaign.subject || campaign.title,
    recipient,
    leadDoc,
    variableMapping,
    variableFallbacks: fallbacks,
  });

  const campaignSignature = typeof campaign.signature === 'string' ? campaign.signature : '';
  let templateFormat = 'visual';
  if (campaign.mailTemplateId) {
    const MailTemplate = require('../models/MailTemplate');
    const tpl = await MailTemplate.findById(campaign.mailTemplateId).select('format').lean();
    if (tpl?.format) templateFormat = tpl.format;
  }
  const processedHtml = await buildFinalEmailHtml({
    html: htmlContent,
    format: templateFormat,
    includeSignature: shouldIncludeSignature,
    signature: campaignSignature || profile.signature || '',
    mode: 'live',
    campaignId: campaign.campaignId || campaign._id.toString(),
    leadEmail: email,
    trackingBaseUrl: baseUrl,
    removeUnsubscribe: campaign.removeUnsubscribe === true,
  });

  const senderFrom = `"${profile.name}" <${profile.email}>`;
  const mailSubject = mergedSubject;
  const attachmentRows = await loadCampaignAttachments(campaign);
  const expectedCount = (campaign.attachments || []).filter((a) => a.storageKey).length;
  if (expectedCount > 0 && attachmentRows.length === 0) {
    logger.warn('Email Processor', 'Campaign attachments missing on disk', {
      campaignId: campaign.campaignId || campaign._id?.toString(),
      expected: expectedCount,
    });
  }
  let messageIdStr = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const campaignTag = campaign.campaignId || campaign._id.toString();

  const { sanitizeResendTags } = require('../../../utils/resendTags');
  const resendPayload = {
    from: senderFrom,
    to: [email],
    subject: mailSubject,
    html: processedHtml,
    headers: { 'X-Campaign-ID': campaignTag },
    tags: sanitizeResendTags([
      { name: 'campaign_id', value: campaignTag },
      { name: 'recipient_email', value: cleanEmail },
    ]),
  };
  if (attachmentRows.length) {
    resendPayload.attachments = formatResendAttachments(attachmentRows);
  }

  const sendViaResend = async () => {
    if (!resend) return false;
    const { data, error } = await resend.emails.send(resendPayload);
    if (error) throw new Error(error.message || 'Resend send failed');
    messageIdStr = data?.id || messageIdStr;
    return true;
  };

  const sendRecipient = getRecipient();
  if (sendRecipient?.status === 'Sent') {
    logger.info('Email Processor', `Skip duplicate send — already Sent: ${email}`);
    await checkCompletion();
    return;
  }

  try {
    const preSendCamp = await Model.findById(campaignId).select('status').lean();
    if (preSendCamp?.status === 'Stopped' || isCampaignStopped(campaignId)) {
      logger.info('Email Processor', `Aborting send — campaign ${campaignId} stopped before dispatch`);
      await skipRecipientAsCancelled('Campaign stopped');
      return;
    }

    if (useResend && resend) {
      await sendViaResend();
    } else {
      const mailPayload = {
        from: senderFrom,
        to: email,
        subject: mailSubject,
        html: processedHtml,
        attachments: formatNodemailerAttachments(attachmentRows),
        headers: { 'X-Campaign-ID': campaignTag },
      };

      const providersToTry = (usesSmtpRotation(profile) && profile._id)
        ? getProfileRotationProviders(profile)
        : (rotationProvider ? [rotationProvider] : [null]);

      const startIdx = jobIndex || 0;
      let sent = false;
      let lastErr = null;
      const smtpErrors = [];

      for (let i = 0; i < providersToTry.length; i++) {
        const providerKey = providersToTry[(startIdx + i) % providersToTry.length];
        const activeTransporter = providerKey ? buildTransporter(profile, providerKey) : transporter;
        if (!activeTransporter) continue;

        const host = providerKey ? SMTP_PRESETS[providerKey]?.smtpHost : profile.smtpHost;

        try {
          const info = await activeTransporter.sendMail(mailPayload);
          messageIdStr = info.messageId;
          usedRotationProvider = providerKey;
          sent = true;
          activeTransporter.close();
          break;
        } catch (smtpErr) {
          lastErr = smtpErr;
          activeTransporter.close();
          smtpErrors.push({ provider: providerKey || 'default', host, error: smtpErr.message });
          logger.warn('Email Processor', `SMTP failed via ${providerKey || 'default'} (${host})`, { error: smtpErr.message });
          if (isRetryableSmtpError(smtpErr) && i < providersToTry.length - 1) continue;
          if (i < providersToTry.length - 1) continue;
        }
      }

      if (!sent && resend) {
        logger.info('Email Processor', `SMTP exhausted for ${email}; falling back to Resend API`);
        await sendViaResend();
        sent = true;
      }

      if (!sent) {
        const detail = smtpErrors.map((e) => `${e.provider || 'default'}@${e.host}: ${e.error}`).join('; ');
        throw lastErr || new Error(
          detail || `No mail transport available for ${email}. Configure RESEND_API_KEY or valid SMTP credentials.`
        );
      }
    }

    const sentRecipient = getRecipient();
    if (sentRecipient) {
      await updateRecipientFields(Model, campaign._id, sentRecipient._id, {
        status: 'Sent',
        sentAt: new Date(),
        messageId: messageIdStr,
      });
    }

    if (isLegacy) {
      await incrementCampaignCounter(Model, campaign._id, true, 'sent', 'totalSent');
    } else {
      await incrementCampaignCounter(Model, campaign._id, false, 'sent', 'totalSent');
    }

    if (profileIdForStats) {
      if (usedRotationProvider) await incrementProviderSendCount(profileIdForStats, usedRotationProvider);
      else await incrementProfileSendCount(profileIdForStats);
    }

    await logEvent({
      eventType: 'Send',
      email,
      campaignId: campaign._id,
      senderProfileId: profileIdForStats || profile?._id || campaign.senderProfileId?._id || campaign.senderProfileId || null,
      rotationProvider: usedRotationProvider || null,
      metadata: { messageId: messageIdStr },
    });

    await checkCompletion();
  } catch (err) {
    const failedRecipient = getRecipient();
    if (failedRecipient) {
      await updateRecipientFields(Model, campaign._id, failedRecipient._id, {
        status: 'Failed',
        error: err.message,
      });
    }
    await logEvent({
      eventType: 'Failed',
      email: cleanEmail,
      campaignId: campaign._id,
      senderProfileId: profileIdForStats || profile?._id || campaign.senderProfileId?._id || campaign.senderProfileId || null,
      rotationProvider: usedRotationProvider || null,
      metadata: { error: err.message, stage: 'send' },
    });
    await checkCompletion();
    throw err;
  } finally {
    if (transporter) transporter.close();
  }
};

const processEmailJob = async (jobData) => {
  const tenantId = jobData.tenantId || getTenantId();
  if (tenantId && !getTenantId()) {
    return runWithWorkerTenant(tenantId, () => processEmailJobInner({ ...jobData, tenantId }));
  }
  return processEmailJobInner({ ...jobData, tenantId });
};

module.exports = { processEmailJob, resolveTrackingBaseUrl };
