const { Resend } = require('resend');
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const { ENV_CONFIG } = require('../config/environment');

const resendApiKey = process.env.RESEND_API_KEY || ENV_CONFIG.resendApiKey;
const resend = resendApiKey && resendApiKey !== 'mock_resend_api_key' ? new Resend(resendApiKey) : null;

if (ENV_CONFIG.mailProvider === 'sendgrid' && ENV_CONFIG.sendgridApiKey) {
  sgMail.setApiKey(ENV_CONFIG.sendgridApiKey);
}

const dispatchEmailPayload = async ({ to, subject, html, from }) => {
  const senderEmail = from || process.env.SYSTEM_VERIFIED_FROM_EMAIL || 'onboarding@resend.dev';

  if (resend) {
    // Primary modern production pipeline via Resend
    try {
      const data = await resend.emails.send({
        from: senderEmail,
        to: [to],
        subject: subject,
        html: html,
      });
      console.log(`📡 [Resend API] Email dispatched successfully to: ${to} (ID: ${data?.id || data?.data?.id})`);
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
        from: `"${from || 'Taskmaster Sandbox'}" <sandbox@taskmaster.io>`,
        to,
        subject,
        html,
      });
      console.log(`🧪 [Sandbox Dev] Email simulated. Preview URL: ${nodemailer.getTestMessageUrl(info) || 'N/A'}`);
    } catch (err) {
      console.log(`🧪 [Sandbox Dev] Mock email dispatch logged for: ${to} - Subject: "${subject}"`);
    }
  }
};

module.exports = { dispatchEmailPayload, resend };
