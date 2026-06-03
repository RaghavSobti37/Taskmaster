const nodemailer = require('nodemailer');
const logger = require('./logger');

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  const user = (process.env.EMAIL_ADDRESS || '').trim();
  const pass = process.env.EMAIL_PASSWORD;
  if (!user || user === 'placeholder@gmail.com' || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: { user, pass },
  });
  return transporter;
};

const sendSystemEmail = async ({ to, subject, html, cc, text }) => {
  const transport = getTransporter();
  if (!transport) {
    throw new Error('System email is not configured (EMAIL_ADDRESS / EMAIL_PASSWORD)');
  }

  const from = (process.env.EMAIL_ADDRESS || '').trim();
  const ccList = cc ? (Array.isArray(cc) ? cc : [cc]).filter(Boolean) : [];

  await transport.sendMail({
    from,
    to,
    subject,
    html,
    text: text || undefined,
    ...(ccList.length ? { cc: ccList.join(', ') } : {}),
  });

  logger.info('sendSystemEmail', 'Email sent', { to, subject });
};

module.exports = { sendSystemEmail };
