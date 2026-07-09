/**
 * Minimal transactional email driver for CoreKnot.
 * Only sends single transactional emails (notifications, announcements, reminders).
 * Campaign/marketing email functionality has been moved to auto-mailer.
 */
const nodemailer = require('nodemailer');

let resendClient = null;
try {
  const { Resend } = require('resend');
  if (process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
} catch (e) {}

function normalizeToList(to) {
  if (!to) return [];
  const list = Array.isArray(to) ? to : String(to).split(/[,;]/);
  const seen = new Set();
  return list
    .map((e) => String(e).trim().toLowerCase())
    .filter((e) => e && /[^\s@]+@[^\s@]+/.test(e) && !seen.has(e) && seen.add(e));
}

async function dispatchEmailPayload({ to, subject, html, from } = {}) {
  const recipients = normalizeToList(to);
  if (!recipients.length) return { error: 'No valid recipients' };
  if (resendClient) {
    try {
      const response = await resendClient.emails.send({
        from: from || process.env.SYSTEM_VERIFIED_FROM_EMAIL || 'onboarding@resend.dev',
        to: recipients, subject, html,
      });
      return { provider: 'resend', ...response };
    } catch (err) { console.warn('[MailDriver] Resend failed:', err.message); }
  }
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      const info = await transporter.sendMail({
        from: from || process.env.SMTP_USER,
        to: recipients.join(', '), subject, html,
      });
      return { provider: 'smtp', ...info };
    } catch (err) { return { error: err.message }; }
  }
  return { error: 'No email provider configured' };
}

module.exports = { dispatchEmailPayload };
