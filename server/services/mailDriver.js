const { Resend } = require('resend');
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const { ENV_CONFIG } = require('../config/environment');

const resendApiKey = process.env.RESEND_API_KEY || ENV_CONFIG.resendApiKey;
const resend = resendApiKey && resendApiKey !== 'mock_resend_api_key' ? new Resend(resendApiKey) : null;

if (ENV_CONFIG.mailProvider === 'sendgrid' && ENV_CONFIG.sendgridApiKey) {
  sgMail.setApiKey(ENV_CONFIG.sendgridApiKey);
}

const dispatchEmailPayload = async ({ to, subject, html, from, cc }) => {
  const senderEmail = from || process.env.SYSTEM_VERIFIED_FROM_EMAIL || 'onboarding@resend.dev';
  const ccList = cc ? (Array.isArray(cc) ? cc : [cc]).filter(Boolean) : [];

  if (resend) {
    // Primary modern production pipeline via Resend
    // Resend SDK returns { data, error } — does not throw on API errors.
    try {
      const payload = {
        from: senderEmail,
        to: [to],
        subject: subject,
        html: html,
      };
      if (ccList.length) payload.cc = ccList;
      const { data, error } = await resend.emails.send(payload);
      if (error) {
        console.error(`❌ [Resend Error] Failed to dispatch email to ${to}:`, error.message);
        throw new Error(error.message || 'Resend send failed');
      }
      console.log(`📡 [Resend API] Email dispatched successfully to: ${to} (ID: ${data?.id})`);
      return data;
    } catch (err) {
      console.error(`❌ [Resend Error] Failed to dispatch email to ${to}:`, err.message);
      throw err;
    }
  } else if (ENV_CONFIG.mailProvider === 'sendgrid' && ENV_CONFIG.sendgridApiKey && !ENV_CONFIG.sendgridApiKey.includes('mock_key')) {
    // SendGrid fallback
    await sgMail.send({
      to,
      from: senderEmail,
      subject,
      html,
      ...(ccList.length ? { cc: ccList } : {}),
    });
    console.log(`📡 [SendGrid] Email dispatched successfully to: ${to}`);
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
        to,
        subject,
        html,
        ...(ccList.length ? { cc: ccList.join(', ') } : {}),
      });
      console.log(`🧪 [Sandbox Dev] Email simulated. Preview URL: ${nodemailer.getTestMessageUrl(info) || 'N/A'}`);
    } catch (err) {
      console.log(`🧪 [Sandbox Dev] Mock email dispatch logged for: ${to} - Subject: "${subject}"`);
    }
  }
};

module.exports = { dispatchEmailPayload, resend };
