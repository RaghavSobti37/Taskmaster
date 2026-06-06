const logger = require('../utils/logger');
const { buildFinalEmailHtml, personalizeEmailContent } = require('../utils/buildFinalEmailHtml');
const { stripUnsubscribe } = require('../utils/emailContentUtils');
const { incrementProfileSendCount, incrementProviderSendCount, resolvePoolProfile, resolveRotationProvider, usesSmtpRotation, getProfileRotationProviders } = require('./profileSendStats');
const { SMTP_PRESETS } = require('../utils/smtpPresets');
const { isAuthError, isRetryableSmtpError } = require('../utils/envProviderCredentials');
const { ENV_CONFIG } = require('../config/environment');
const { buildProfileTransporter, buildEnvTransporter, resolveMailTransport, sendViaTransport } = require('../utils/smtpTransport');
const fs = require('fs');
const path = require('path');

const { resolveTrackingApiBaseUrl } = require('../utils/trackingUrls');
const resolveTrackingBaseUrl = () => resolveTrackingApiBaseUrl();

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
    { arrayFilters: [{ 'elem._id': recipientId }] }
  );
};

const incrementCampaignCounter = async (Model, campaignId, isLegacy, legacyField, coreField) => {
  if (isLegacy) {
    await Model.findByIdAndUpdate(campaignId, { $inc: { [`stats.${legacyField}`]: 1 } });
  } else {
    await Model.findByIdAndUpdate(campaignId, { $inc: { [`metrics.${coreField}`]: 1 } });
  }
};

const buildTransporter = (profile, providerKey = null) => buildProfileTransporter(profile, providerKey);

const buildEnvSmtpTransporter = () => buildEnvTransporter();

const logCampaignEvent = async (MailEvent, { eventType, email, campaignId, metadata, senderProfileId, rotationProvider }) => {
  try {
    await MailEvent.create({
      eventType,
      email,
      timestamp: new Date(),
      campaignId,
      metadata: metadata || undefined,
      senderProfileId: senderProfileId || undefined,
      rotationProvider: rotationProvider || undefined,
    });
  } catch (e) {
    logger.warn('Email Processor', 'Failed to log mail event', { eventType, error: e.message });
  }
};

const loadAttachments = async (campaign) => {
  const fsPromises = fs.promises;
  const uploadDir = path.join(__dirname, '../uploads/campaign-attachments');
  const rows = await Promise.all((campaign.attachments || []).map(async (att) => {
    const filePath = path.join(uploadDir, att.storageKey);
    if (!att.storageKey) return null;
    try {
      await fsPromises.access(filePath);
    } catch {
      return null;
    }
    const content = await fsPromises.readFile(filePath);
    return {
      filename: att.filename,
      content,
      contentType: att.contentType || 'application/octet-stream',
    };
  }));
  return rows.filter(Boolean);
};

const resolveSender = async (campaign, profileId, jobIndex) => {
  const EmailProfile = require('../models/EmailProfile');
  const { resend } = require('./mailDriver');
  const mode = campaign.senderMode || 'single';

  if (mode === 'system_resend') {
    if (!resend) {
      throw new Error('RESEND_API_KEY not configured. Cannot use System Resend sender mode.');
    }
    const fromEmail = process.env.SYSTEM_VERIFIED_FROM_EMAIL || campaign.senderProfileId?.email;
    return {
      profile: {
        name: 'System Resend',
        email: fromEmail || 'onboarding@resend.dev',
        signature: campaign.senderProfileId?.signature || ''
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

const processEmailJob = async ({ campaignId, recipientId, email, subject, content, profileId, isLegacy, jobIndex }) => {
  const Campaign = require('../models/Campaign');
  const MailCampaign = require('../models/MailCampaign');
  const MailEvent = require('../models/MailEvent');
  const { isCampaignStopped } = require('./campaignQueueState');

  let Model = Campaign;
  let campaign = await Campaign.findById(campaignId).populate('senderProfileId').populate('senderProfileIds');
  if (!campaign) {
    campaign = await MailCampaign.findById(campaignId).populate('senderProfileId');
    Model = MailCampaign;
    isLegacy = true;
  }
  if (!campaign) return;

  const getRecipient = () => (
    campaign.recipients?.id
      ? campaign.recipients.id(recipientId)
      : campaign.recipients?.find((r) => r._id?.toString() === recipientId?.toString() || r.email === email)
  );

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

  const checkCompletion = async () => {
    const freshCamp = await Model.findById(campaignId).select('recipients status').lean();
    if (freshCamp?.recipients) {
      const isDone = freshCamp.recipients.every((r) => r.status !== 'Pending' && r.status !== 'Queued');
      if (isDone && freshCamp.status !== 'Stopped') {
        await Model.findByIdAndUpdate(campaignId, { $set: { status: 'Completed' } });
      }
    }
  };

  const freshCamp = await Model.findById(campaignId).select('status').lean();
  if (freshCamp?.status === 'Stopped' || isCampaignStopped(campaignId)) {
    logger.info('Email Processor', `Skipping send — campaign ${campaignId} is stopped`);
    await skipRecipientAsCancelled('Campaign stopped');
    return;
  }

  const Lead = require('../models/Lead');
  const { isValidEmail, normalizeEmail } = require('../utils/emailValidation');
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
    await logCampaignEvent(MailEvent, {
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
    await logCampaignEvent(MailEvent, {
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
    await logCampaignEvent(MailEvent, {
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

  const processedHtml = await buildFinalEmailHtml({
    html: htmlContent,
    includeSignature: shouldIncludeSignature,
    signature: profile.signature || '',
    mode: 'live',
    campaignId: campaign.campaignId || campaign._id.toString(),
    leadEmail: email,
    trackingBaseUrl: baseUrl,
    removeUnsubscribe: campaign.removeUnsubscribe === true,
  });

  const senderFrom = `"${profile.name}" <${profile.email}>`;
  const mailSubject = mergedSubject;
  const mailAttachments = await loadAttachments(campaign);
  let messageIdStr = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const campaignTag = campaign.campaignId || campaign._id.toString();

  const resendPayload = {
    from: senderFrom,
    to: [email],
    subject: mailSubject,
    html: processedHtml,
    headers: { 'X-Campaign-ID': campaignTag },
    tags: [
      { name: 'campaign_id', value: campaignTag.slice(0, 256) },
      { name: 'recipient_email', value: cleanEmail.slice(0, 256) },
    ],
  };
  if (mailAttachments.length) {
    resendPayload.attachments = mailAttachments.map((a) => ({ filename: a.filename, content: a.content }));
  }

  const sendViaResend = async () => {
    if (!resend) return false;
    const resp = await resend.emails.send(resendPayload);
    messageIdStr = resp?.id || resp?.data?.id || messageIdStr;
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
        attachments: mailAttachments,
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

    await logCampaignEvent(MailEvent, {
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
    await logCampaignEvent(MailEvent, {
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

module.exports = { processEmailJob, resolveTrackingBaseUrl };
