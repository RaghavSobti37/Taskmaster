const nodemailer = require('nodemailer');
const { ENV_CONFIG } = require('../config/environment');

const INVALID_HOSTS = new Set(['', 'localhost', '127.0.0.1', 'mock_smtp_host']);

const isValidSmtpHost = (host) => {
  if (!host || typeof host !== 'string') return false;
  return !INVALID_HOSTS.has(host.trim().toLowerCase());
};

const buildProfileTransporter = (profile, providerKey = null) => {
  if (!profile) return null;

  let host = profile.smtpHost;
  let port = profile.smtpPort || 587;
  let secure = port === 465;

  if (profile.rotationEnabled !== false && providerKey) {
    const { SMTP_PRESETS } = require('./smtpPresets');
    const preset = SMTP_PRESETS[providerKey];
    if (!preset?.smtpHost) return null;
    host = preset.smtpHost;
    port = preset.smtpPort || 587;
    secure = preset.secure ?? port === 465;
  }

  if (!isValidSmtpHost(host) || host === 'rotation') return null;

  const { resolveProviderAuth } = require('./smtpPresets');
  const auth = providerKey
    ? resolveProviderAuth(profile, providerKey)
    : { user: profile.smtpUser, pass: profile.smtpPass };
  if (!auth?.user || !auth?.pass) return null;

  return nodemailer.createTransport({
    host: host.trim(),
    port,
    secure,
    auth: { user: auth.user, pass: auth.pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });
};

const buildEnvTransporter = () => {
  const host = process.env.SMTP_HOST || ENV_CONFIG.smtp?.host;
  const user = process.env.SMTP_USER || ENV_CONFIG.smtp?.user;
  const pass = process.env.SMTP_PASS || ENV_CONFIG.smtp?.pass;
  const port = parseInt(process.env.SMTP_PORT || String(ENV_CONFIG.smtp?.port || 587), 10);
  if (!isValidSmtpHost(host) || !user) return null;
  return nodemailer.createTransport({
    host: host.trim(),
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });
};

/**
 * Resolve how to send mail for test/campaign paths.
 * @returns {{ type: 'resend'|'smtp', resend?, transporter?, fromEmail, fromName }}
 */
const resolveMailTransport = async ({ senderMode, profile, preferResend = true, providerKey = null }) => {
  const { resend } = require('../services/mailDriver');
  const { usesSmtpRotation, resolveRotationProvider } = require('../services/profileSendStats');
  const mode = senderMode || 'single';

  if (mode === 'system_resend') {
    if (!resend) {
      throw new Error('RESEND_API_KEY is not configured in server/.env. Add your Resend API key or pick an SMTP profile instead.');
    }
    return {
      type: 'resend',
      resend,
      fromEmail: profile?.email || process.env.SYSTEM_VERIFIED_FROM_EMAIL || 'onboarding@resend.dev',
      fromName: profile?.name || 'System Resend'
    };
  }

  if (mode === 'system_smtp') {
    const transporter = buildEnvTransporter();
    if (!transporter) {
      throw new Error('System SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in server/.env (use smtp.gmail.com, not localhost).');
    }
    return {
      type: 'smtp',
      transporter,
      fromEmail: process.env.SYSTEM_VERIFIED_FROM_EMAIL || process.env.SMTP_USER || profile?.email,
      fromName: profile?.name || 'System SMTP'
    };
  }

  let rotationKey = providerKey;
  if (!rotationKey && usesSmtpRotation(profile)) {
    rotationKey = await resolveRotationProvider(profile, 0);
    if (!rotationKey) {
      throw new Error('All free SMTP servers have reached their daily limit. Resets at midnight UTC.');
    }
  }

  const transporter = buildProfileTransporter(profile, rotationKey);
  if (transporter) {
    return {
      type: 'smtp',
      transporter,
      fromEmail: profile.email,
      fromName: profile.name || profile.email,
      rotationProvider: rotationKey || null,
    };
  }

  if (preferResend && resend && !usesSmtpRotation(profile)) {
    return {
      type: 'resend',
      resend,
      fromEmail: profile?.email || process.env.SYSTEM_VERIFIED_FROM_EMAIL || 'onboarding@resend.dev',
      fromName: profile?.name || 'Mail Engine'
    };
  }

  const label = profile?.name || 'Selected profile';
  throw new Error(
    `Cannot send via "${label}": SMTP host is missing or invalid (got "${profile?.smtpHost || ''}"). ` +
    'Edit the profile with a real host like smtp.gmail.com, or choose System Resend / set RESEND_API_KEY.'
  );
};

const sendViaTransport = async ({ transport, to, subject, html, fromEmail, fromName, tags }) => {
  const from = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;

  if (transport.type === 'resend') {
    const payload = { from, to: Array.isArray(to) ? to : [to], subject, html };
    if (tags?.length) payload.tags = tags;
    const resp = await transport.resend.emails.send(payload);
    return resp?.id || resp?.data?.id || `resend_${Date.now()}`;
  }

  const info = await transport.transporter.sendMail({ from, to, subject, html });
  return info.messageId;
};

module.exports = {
  isValidSmtpHost,
  buildProfileTransporter,
  buildEnvTransporter,
  resolveMailTransport,
  sendViaTransport
};
