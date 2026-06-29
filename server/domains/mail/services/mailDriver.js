const { Resend } = require('resend');
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const { ENV_CONFIG } = require('../../../config/environment');
const logger = require('../../../utils/logger');

const resendApiKey = process.env.RESEND_API_KEY || ENV_CONFIG.resendApiKey;
const resend = resendApiKey && resendApiKey !== 'mock_resend_api_key' ? new Resend(resendApiKey) : null;

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

const dispatchEmailPayload = async ({ to, subject, html, from, cc }) => {
  const senderEmail = from || process.env.SYSTEM_VERIFIED_FROM_EMAIL || 'onboarding@resend.dev';
  const ccList = cc ? (Array.isArray(cc) ? cc : [cc]).filter(Boolean) : [];
  const toList = normalizeToList(to);
  if (!toList.length) throw new Error('Email dispatch requires at least one recipient');

  if (resend) {
    // Primary modern production pipeline via Resend
    // Resend SDK returns { data, error } — does not throw on API errors.
    try {
      const payload = {
        from: senderEmail,
        to: toList,
        subject: subject,
        html: html,
      };
      if (ccList.length) payload.cc = ccList;
      const { data, error } = await resend.emails.send(payload);
      if (error) {
        console.error(`❌ [Resend Error] Failed to dispatch email to ${toList.join(', ')}:`, error.message);
        throw new Error(error.message || 'Resend send failed');
      }
      logger.info('mail', `Resend email dispatched to: ${toList.join(', ')}`, { id: data?.id });
      return data;
    } catch (err) {
      console.error(`❌ [Resend Error] Failed to dispatch email to ${toList.join(', ')}:`, err.message);
      throw err;
    }
  } else if (ENV_CONFIG.mailProvider === 'sendgrid' && ENV_CONFIG.sendgridApiKey && !ENV_CONFIG.sendgridApiKey.includes('mock_key')) {
    // SendGrid fallback
    await sgMail.send({
      to: toList,
      from: senderEmail,
      subject,
      html,
      ...(ccList.length ? { cc: ccList } : {}),
    });
    logger.info('mail', `SendGrid email dispatched to: ${toList.join(', ')}`);
  } else {
    // Local development fallback testing loop
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
      logger.debug('mail', `Sandbox email simulated`, { preview: nodemailer.getTestMessageUrl(info) || 'N/A' });
    } catch (err) {
      logger.debug('mail', `Sandbox mock dispatch for: ${toList.join(', ')}`, { subject });
    }
  }
};

module.exports = { dispatchEmailPayload, resend };
