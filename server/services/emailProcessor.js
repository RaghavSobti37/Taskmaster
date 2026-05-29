const logger = require('../utils/logger');
const { prepareCampaignHTML } = require('../utils/emailTracker');
const { appendSignatureIfMissing } = require('../utils/emailSignature');
const { applyMergeTags, buildRecipientValues } = require('../utils/mergeTags');
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

const loadAttachments = (campaign) => {
  const uploadDir = path.join(__dirname, '../uploads/campaign-attachments');
  return (campaign.attachments || []).map((att) => {
    const filePath = path.join(uploadDir, att.storageKey);
    if (!att.storageKey || !fs.existsSync(filePath)) return null;
    return {
      filename: att.filename,
      content: fs.readFileSync(filePath),
      contentType: att.contentType || 'application/octet-stream'
    };
  }).filter(Boolean);
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
    const fromEmail = process.env.SYSTEM_VERIFIED_FROM_EMAIL || ENV_CONFIG.smtp?.user || 'system@taskmaster.internal';
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
    || { name: 'Taskmaster Core Engine', email: 'system@taskmaster.internal', smtpHost: 'mock_smtp_host' };

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

  let Model = Campaign;
  let campaign = await Campaign.findById(campaignId).populate('senderProfileId').populate('senderProfileIds');
  if (!campaign) {
    campaign = await MailCampaign.findById(campaignId).populate('senderProfileId');
    Model = MailCampaign;
    isLegacy = true;
  }
  if (!campaign) return;

  const checkCompletion = async () => {
    const freshCamp = await Model.findById(campaignId);
    if (freshCamp?.recipients) {
      const isDone = freshCamp.recipients.every((r) => r.status !== 'Pending' && r.status !== 'Queued');
      if (isDone) {
        freshCamp.status = 'Completed';
        try { await freshCamp.save(); } catch (e) {}
      }
    }
  };

  const Lead = require('../models/Lead');
  const cleanEmail = email.toLowerCase().trim();
  const leadDoc = await Lead.findOne({ email: cleanEmail });
  if (leadDoc && (leadDoc.unsubscribed === true || leadDoc.emailStatus === 'Unsubscribed' || leadDoc.emailStatus === 'Bounced' || leadDoc.emailStatus === 'Invalid')) {
    logger.info('Queue Service', `Skipping bad/unsubscribed recipient: ${email}`);
    const recipient = campaign.recipients?.id ? campaign.recipients.id(recipientId) : campaign.recipients?.find((r) => r._id.toString() === recipientId.toString() || r.email === email);
    if (recipient) {
      recipient.status = (leadDoc.emailStatus === 'Unsubscribed' || leadDoc.unsubscribed === true) ? 'Unsubscribed' : 'Bounced';
      recipient.error = 'Unsubscribed or Bounced recipient';
    }
    if (isLegacy) {
      if (leadDoc.emailStatus === 'Unsubscribed' || leadDoc.unsubscribed === true) {
        campaign.stats.unsubscribed = (campaign.stats.unsubscribed || 0) + 1;
      } else {
        campaign.stats.bounced = (campaign.stats.bounced || 0) + 1;
      }
    } else if (!campaign.metrics) {
      campaign.metrics = { totalSent: 0, opened: 0, clicked: 0, bounced: 0 };
    } else if (leadDoc.emailStatus === 'Bounced' || leadDoc.emailStatus === 'Invalid') {
      campaign.metrics.bounced = (campaign.metrics.bounced || 0) + 1;
    }
    try { await campaign.save(); } catch (e) {}
    await logCampaignEvent(MailEvent, {
      eventType: recipient?.status === 'Unsubscribed' ? 'Skipped' : 'Failed',
      email: cleanEmail,
      campaignId: campaign._id,
      metadata: { reason: recipient?.error || 'Skipped recipient', status: recipient?.status },
    });
    await checkCompletion();
    return;
  }

  let sender;
  try {
    sender = await resolveSender(campaign, profileId, jobIndex);
  } catch (err) {
    const recipient = campaign.recipients?.id ? campaign.recipients.id(recipientId) : campaign.recipients?.find((r) => r._id.toString() === recipientId.toString());
    if (recipient) {
      recipient.status = 'Failed';
      recipient.error = err.message;
    }
    try { await campaign.save(); } catch (e) {}
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
  logger.info('Email Processor', `Tracking base URL: ${baseUrl}`);

  const recipient = campaign.recipients?.id
    ? campaign.recipients.id(recipientId)
    : campaign.recipients?.find((r) => r._id?.toString() === recipientId?.toString() || r.email === email);

  let htmlContent = content || campaign.content || '';
  const shouldIncludeSignature = campaign.includeSignature !== false;

  if (campaign.removeUnsubscribe) {
    htmlContent = stripUnsubscribe(htmlContent);
  }

  const mergeValues = buildRecipientValues(recipient, leadDoc);
  const fallbacks = campaign.variableFallbacks instanceof Map
    ? Object.fromEntries(campaign.variableFallbacks.entries())
    : (campaign.variableFallbacks || {});
  htmlContent = applyMergeTags(htmlContent, mergeValues, fallbacks);

  if (shouldIncludeSignature && profile.signature) {
    htmlContent = appendSignatureIfMissing(htmlContent, profile.signature);
  }

  const mergedSubject = applyMergeTags(subject || campaign.subject || campaign.title, mergeValues, fallbacks);

  const { processedHtml } = await prepareCampaignHTML(
    htmlContent,
    campaign.campaignId || campaign._id.toString(),
    email,
    baseUrl,
    { skipAutoFooter: campaign.removeUnsubscribe === true }
  );

  const senderFrom = `"${profile.name}" <${profile.email}>`;
  const mailSubject = mergedSubject;
  const mailAttachments = loadAttachments(campaign);
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

  try {
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

    const recipient = campaign.recipients?.id ? campaign.recipients.id(recipientId) : campaign.recipients?.find((r) => r._id.toString() === recipientId.toString());
    if (recipient) {
      recipient.status = 'Sent';
      recipient.sentAt = new Date();
      recipient.messageId = messageIdStr;
    }

    if (isLegacy) {
      campaign.stats.sent = (campaign.stats.sent || 0) + 1;
    } else {
      if (!campaign.metrics) campaign.metrics = { totalSent: 0, opened: 0, clicked: 0, bounced: 0 };
      campaign.metrics.totalSent = (campaign.metrics.totalSent || 0) + 1;
    }
    try { await campaign.save(); } catch (err) { if (err.name !== 'VersionError' && err.name !== 'DocumentNotFoundError') logger.error('Queue Service', 'Campaign save error', { error: err.message }); }

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
    const recipient = campaign.recipients?.id ? campaign.recipients.id(recipientId) : campaign.recipients?.find((r) => r._id.toString() === recipientId.toString());
    if (recipient) {
      recipient.status = 'Failed';
      recipient.error = err.message;
    }
    try { await campaign.save(); } catch (e) { if (e.name !== 'VersionError' && e.name !== 'DocumentNotFoundError') logger.error('Queue Service', 'Campaign fail save error', { error: e.message }); }
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
