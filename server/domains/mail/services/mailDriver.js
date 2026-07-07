const { Resend } = require('resend');
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const { ENV_CONFIG } = require('../../../config/environment');
const logger = require('../../../utils/logger');

const resendApiKey = process.env.RESEND_API_KEY || ENV_CONFIG.resendApiKey;
const globalResend = resendApiKey && resendApiKey !== 'mock_resend_api_key' ? new Resend(resendApiKey) : null;

if (ENV_CONFIG.mailProvider === 'sendgrid' && ENV_CONFIG.sendgridApiKey) {
  sgMail.setApiKey(ENV_CONFIG.sendgridApiKey);
}

const normalizeToList = (to) => {
  if (!to) return [];
  const parts = Array.isArray(to) ? to : [to];
  return [...new Set(
    parts
      .flatMap((entry) => String(entry).split(/[,;]/))
      .map((email) => email.trim())
      .filter(Boolean),
  )];
};

async function resolveTenantResendClient(tenantId) {
  if (!tenantId) return null;
  try {
    const { getConnectedIntegration } = require('../../integrations-hub/services/integrationService');
    const { unpackCredentials } = require('../../integrations-hub/services/integrationCredentialService');
    const doc = await getConnectedIntegration(tenantId, 'resend');
    if (!doc?.credentialsEncrypted) return null;
    const credentials = unpackCredentials(doc.credentialsEncrypted);
    if (!credentials?.apiKey) return null;
    return new Resend(credentials.apiKey);
  } catch (err) {
    logger.warn('mail', 'tenant Resend lookup failed', { tenantId, error: err.message });
    return null;
  }
}

async function sendViaResend(resendClient, { toList, subject, html, senderEmail, ccList }) {
  const payload = {
    from: senderEmail,
    to: toList,
    subject,
    html,
  };
  if (ccList.length) payload.cc = ccList;
  const { data, error } = await resendClient.emails.send(payload);
  if (error) {
    throw new Error(error.message || 'Resend send failed');
  }
  logger.info('mail', `Resend email dispatched to: ${toList.join(', ')}`, { id: data?.id });
  return data;
}

const dispatchEmailPayload = async ({ to, subject, html, from, cc, tenantId, preferGmail }) => {
  const senderEmail = from || process.env.SYSTEM_VERIFIED_FROM_EMAIL || 'onboarding@resend.dev';
  const ccList = cc ? (Array.isArray(cc) ? cc : [cc]).filter(Boolean) : [];
  const toList = normalizeToList(to);
  if (!toList.length) throw new Error('Email dispatch requires at least one recipient');

  if (tenantId && preferGmail) {
    try {
      const { sendViaGmailIntegration } = require('./gmailApiDriver');
      const gmailResult = await sendViaGmailIntegration({
        tenantId,
        to: toList,
        subject,
        html,
        from: senderEmail,
      });
      if (gmailResult) return gmailResult;
    } catch (err) {
      logger.warn('mail', 'Gmail integration send failed; falling back', { error: err.message });
    }
  }

  const tenantResend = await resolveTenantResendClient(tenantId);
  const resendClient = tenantResend || globalResend;

  if (resendClient) {
    try {
      return await sendViaResend(resendClient, { toList, subject, html, senderEmail, ccList });
    } catch (err) {
      console.error(`❌ [Resend Error] Failed to dispatch email to ${toList.join(', ')}:`, err.message);
      throw err;
    }
  }

  if (ENV_CONFIG.mailProvider === 'sendgrid' && ENV_CONFIG.sendgridApiKey && !ENV_CONFIG.sendgridApiKey.includes('mock_key')) {
    await sgMail.send({
      to: toList,
      from: senderEmail,
      subject,
      html,
      ...(ccList.length ? { cc: ccList } : {}),
    });
    logger.info('mail', `SendGrid email dispatched to: ${toList.join(', ')}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: ENV_CONFIG.smtp?.host || 'smtp.ethereal.email',
    port: ENV_CONFIG.smtp?.port || 587,
    auth: {
      user: ENV_CONFIG.smtp?.user || 'mock_user',
      pass: ENV_CONFIG.smtp?.pass || 'mock_pass',
    },
  });

  try {
    const info = await transporter.sendMail({
      from: `"${from || 'Coreknot Sandbox'}" <sandbox@coreknot.io>`,
      to: toList.join(', '),
      subject,
      html,
      ...(ccList.length ? { cc: ccList.join(', ') } : {}),
    });
    logger.debug('mail', 'Sandbox email simulated', { preview: nodemailer.getTestMessageUrl(info) || 'N/A' });
  } catch (err) {
    logger.debug('mail', `Sandbox mock dispatch for: ${toList.join(', ')}`, { subject });
  }
};

module.exports = { dispatchEmailPayload, resend: globalResend };
