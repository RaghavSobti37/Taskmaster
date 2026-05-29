const logger = require('../utils/logger');
const { prepareCampaignHTML } = require('../utils/emailTracker');
const { appendSignatureIfMissing } = require('../utils/emailSignature');
const { incrementProfileSendCount, resolvePoolProfile } = require('./profileSendStats');
const { ENV_CONFIG } = require('../config/environment');
const fs = require('fs');
const path = require('path');

const resolveTrackingBaseUrl = () => {
  let baseUrl = process.env.APP_BASE_URL || 'https://taskmaster-api.onrender.com';
  const useLocalTracking = process.env.TRACKING_USE_LOCAL === 'true';
  if (!useLocalTracking && (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1'))) {
    baseUrl = 'https://taskmaster-api.onrender.com';
  }
  return baseUrl.replace(/\/$/, '');
};

const buildTransporter = (profile) => {
  const nodemailer = require('nodemailer');
  return nodemailer.createTransport({
    host: profile.smtpHost || 'smtp.gmail.com',
    port: profile.smtpPort || 587,
    secure: profile.smtpPort === 465,
    auth: { user: profile.smtpUser, pass: profile.smtpPass },
    tls: { rejectUnauthorized: false }
  });
};

const buildEnvSmtpTransporter = () => {
  const nodemailer = require('nodemailer');
  if (!ENV_CONFIG.smtp?.host || !ENV_CONFIG.smtp?.user) return null;
  return nodemailer.createTransport({
    host: ENV_CONFIG.smtp.host,
    port: ENV_CONFIG.smtp.port || 587,
    secure: ENV_CONFIG.smtp.port === 465,
    auth: { user: ENV_CONFIG.smtp.user, pass: ENV_CONFIG.smtp.pass },
    tls: { rejectUnauthorized: false }
  });
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
    const poolProfile = await resolvePoolProfile(poolIds, jobIndex || 0);
    if (!poolProfile) throw new Error('All SMTP profiles in pool have reached their daily send limit');
    return {
      profile: poolProfile,
      useResend: false,
      transporter: poolProfile.smtpHost ? buildTransporter(poolProfile) : null,
      profileIdForStats: poolProfile._id
    };
  }

  const profile = campaign.senderProfileId
    || (profileId ? await EmailProfile.findById(profileId) : null)
    || { name: 'Taskmaster Core Engine', email: 'system@taskmaster.internal', smtpHost: 'mock_smtp_host' };

  const { resend: globalResend } = require('./mailDriver');
  const useResend = !!globalResend;
  const transporter = (!useResend && profile.smtpHost && profile.smtpHost !== 'mock_smtp_host')
    ? buildTransporter(profile)
    : null;

  return {
    profile,
    useResend,
    transporter,
    profileIdForStats: profile._id || null
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
    await checkCompletion();
    throw err;
  }

  const { profile, useResend, transporter, profileIdForStats } = sender;
  const { resend } = require('./mailDriver');

  const baseUrl = resolveTrackingBaseUrl();
  logger.info('Email Processor', `Tracking base URL: ${baseUrl}`);

  let htmlContent = content || campaign.content || '';
  const shouldIncludeSignature = campaign.includeSignature !== false;
  if (shouldIncludeSignature && profile.signature) {
    htmlContent = appendSignatureIfMissing(htmlContent, profile.signature);
  }

  const { processedHtml } = await prepareCampaignHTML(
    htmlContent,
    campaign.campaignId || campaign._id.toString(),
    email,
    baseUrl
  );

  const senderFrom = `"${profile.name}" <${profile.email}>`;
  const mailSubject = subject || campaign.subject || campaign.title;
  const mailAttachments = loadAttachments(campaign);
  let messageIdStr = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const campaignTag = campaign.campaignId || campaign._id.toString();

  try {
    if (useResend && resend) {
      const payload = {
        from: senderFrom,
        to: [email],
        subject: mailSubject,
        html: processedHtml,
        headers: { 'X-Campaign-ID': campaignTag },
        tags: [
          { name: 'campaign_id', value: campaignTag.slice(0, 256) },
          { name: 'recipient_email', value: cleanEmail.slice(0, 256) }
        ]
      };
      if (mailAttachments.length) payload.attachments = mailAttachments.map((a) => ({ filename: a.filename, content: a.content }));
      const resp = await resend.emails.send(payload);
      messageIdStr = resp?.id || resp?.data?.id || messageIdStr;
    } else if (transporter) {
      const info = await transporter.sendMail({
        from: senderFrom,
        to: email,
        subject: mailSubject,
        html: processedHtml,
        attachments: mailAttachments,
        headers: { 'X-Campaign-ID': campaignTag }
      });
      messageIdStr = info.messageId;
    } else {
      logger.info('Memory Queue', `Simulated dispatch to ${email}`);
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

    if (profileIdForStats) await incrementProfileSendCount(profileIdForStats);

    await MailEvent.create({
      messageId: messageIdStr,
      eventType: 'Send',
      email,
      timestamp: new Date(),
      campaignId: campaign._id
    });

    await checkCompletion();
  } catch (err) {
    const recipient = campaign.recipients?.id ? campaign.recipients.id(recipientId) : campaign.recipients?.find((r) => r._id.toString() === recipientId.toString());
    if (recipient) {
      recipient.status = 'Failed';
      recipient.error = err.message;
    }
    try { await campaign.save(); } catch (e) { if (e.name !== 'VersionError' && e.name !== 'DocumentNotFoundError') logger.error('Queue Service', 'Campaign fail save error', { error: e.message }); }
    await checkCompletion();
    throw err;
  } finally {
    if (transporter) transporter.close();
  }
};

module.exports = { processEmailJob, resolveTrackingBaseUrl };
