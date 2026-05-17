const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const { ENV_CONFIG } = require('../config/environment');

if (ENV_CONFIG.mailProvider === 'sendgrid' && ENV_CONFIG.sendgridApiKey) {
  sgMail.setApiKey(ENV_CONFIG.sendgridApiKey);
}

const dispatchEmailPayload = async ({ to, subject, html }) => {
  if (ENV_CONFIG.mailProvider === 'sendgrid') {
    // Production email pipeline
    await sgMail.send({
      to,
      from: process.env.SYSTEM_VERIFIED_FROM_EMAIL || 'sandbox@taskmaster.io', // Must be verified in SendGrid settings
      subject,
      html,
    });
    console.log(`📡 [Production] Email dispatched via SendGrid successfully to: ${to}`);
  } else {
    // Local development fallback testing loop
    const transporter = nodemailer.createTransport({
      host: ENV_CONFIG.smtp.host,
      port: ENV_CONFIG.smtp.port,
      auth: {
        user: ENV_CONFIG.smtp.user, // Generates dynamic mock credentials using ethereal.email
        pass: ENV_CONFIG.smtp.pass,
      },
    });

    const info = await transporter.sendMail({
      from: '"Taskmaster Local Test" <sandbox@taskmaster.io>',
      to,
      subject,
      html,
    });
    
    console.log(`🧪 [Sandbox Dev] Email dispatched. Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
  }
};

module.exports = { dispatchEmailPayload };
