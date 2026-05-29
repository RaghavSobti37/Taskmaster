/** Free / freemium SMTP providers suitable for rotation pools */
const SMTP_PRESETS = {
  gmail: { label: 'Gmail', smtpHost: 'smtp.gmail.com', smtpPort: 587, dailyLimit: 500, secure: false },
  outlook: { label: 'Outlook / Office 365', smtpHost: 'smtp.office365.com', smtpPort: 587, dailyLimit: 300, secure: false },
  yahoo: { label: 'Yahoo Mail', smtpHost: 'smtp.mail.yahoo.com', smtpPort: 465, dailyLimit: 500, secure: true },
  aol: { label: 'AOL Mail', smtpHost: 'smtp.aol.com', smtpPort: 465, dailyLimit: 500, secure: true },
  zoho: { label: 'Zoho Mail', smtpHost: 'smtp.zoho.com', smtpPort: 587, dailyLimit: 500, secure: false },
  icloud: { label: 'iCloud Mail', smtpHost: 'smtp.mail.me.com', smtpPort: 587, dailyLimit: 1000, secure: false },
  gmx: { label: 'GMX Mail', smtpHost: 'mail.gmx.com', smtpPort: 587, dailyLimit: 50, secure: false },
  brevo: { label: 'Brevo (Sendinblue)', smtpHost: 'smtp-relay.brevo.com', smtpPort: 587, dailyLimit: 300, secure: false },
  sendgrid: { label: 'SendGrid SMTP', smtpHost: 'smtp.sendgrid.net', smtpPort: 587, dailyLimit: 100, secure: false },
  mailjet: { label: 'Mailjet', smtpHost: 'in-v3.mailjet.com', smtpPort: 587, dailyLimit: 200, secure: false },
  elasticemail: { label: 'Elastic Email', smtpHost: 'smtp.elasticemail.com', smtpPort: 2525, dailyLimit: 100, secure: false },
  mailgun: { label: 'Mailgun', smtpHost: 'smtp.mailgun.org', smtpPort: 587, dailyLimit: 10, secure: false },
  amazon_ses: { label: 'Amazon SES', smtpHost: 'email-smtp.us-east-1.amazonaws.com', smtpPort: 587, dailyLimit: 200, secure: false },
  mailersend: { label: 'MailerSend', smtpHost: 'smtp.mailersend.net', smtpPort: 587, dailyLimit: 17, secure: false },
  smtp2go: { label: 'SMTP2GO', smtpHost: 'mail.smtp2go.com', smtpPort: 2525, dailyLimit: 33, secure: false },
  sparkpost: { label: 'SparkPost', smtpHost: 'smtp.sparkpostmail.com', smtpPort: 587, dailyLimit: 17, secure: false },
  postmark: { label: 'Postmark', smtpHost: 'smtp.postmarkapp.com', smtpPort: 587, dailyLimit: 100, secure: false },
  resend: { label: 'Resend (API)', smtpHost: '', smtpPort: 587, dailyLimit: 100, secure: false },
  custom: { label: 'Custom SMTP', smtpHost: '', smtpPort: 587, dailyLimit: 500, secure: false },
};

/** Presets with real SMTP hosts — used for rotation pool seeding */
const FREE_ROTATION_PROVIDER_KEYS = Object.keys(SMTP_PRESETS).filter(
  (key) => key !== 'custom' && key !== 'resend' && SMTP_PRESETS[key].smtpHost
);

/** Map login email domain → SMTP provider key */
const DOMAIN_PROVIDER_RULES = [
  { pattern: /@(gmail|googlemail)\.com$/i, provider: 'gmail' },
  { pattern: /@(outlook|hotmail|live|msn)\.com$/i, provider: 'outlook' },
  { pattern: /@(yahoo|ymail)\.com$/i, provider: 'yahoo' },
  { pattern: /@aol\.com$/i, provider: 'aol' },
  { pattern: /@zoho\.com$/i, provider: 'zoho' },
  { pattern: /@(icloud|me|mac)\.com$/i, provider: 'icloud' },
  { pattern: /@gmx\.(com|net|de)$/i, provider: 'gmx' },
];

const inferProviderFromEmail = (email) => {
  const addr = (email || '').trim().toLowerCase();
  if (!addr.includes('@')) return null;
  for (const { pattern, provider } of DOMAIN_PROVIDER_RULES) {
    if (pattern.test(addr)) return provider;
  }
  // Google Workspace custom domain → Gmail SMTP when EMAIL_SERVICE=gmail in .env
  const envEmail = (process.env.EMAIL_ADDRESS || '').trim().toLowerCase();
  if (
    (process.env.EMAIL_SERVICE || '').toLowerCase() === 'gmail'
    && envEmail
    && addr === envEmail
  ) {
    return 'gmail';
  }
  return null;
};

const findProviderByHost = (host) => {
  if (!host || host === 'rotation') return null;
  const normalized = host.trim().toLowerCase();
  return Object.entries(SMTP_PRESETS).find(([, p]) => p.smtpHost?.toLowerCase() === normalized)?.[0] || null;
};

/** Transactional providers — each needs its own SMTP credentials on the profile */
const ADDITIONAL_ROTATION_PROVIDERS = [
  'brevo', 'sendgrid', 'mailjet', 'elasticemail', 'smtp2go',
  'mailersend', 'amazon_ses', 'mailgun', 'sparkpost', 'postmark',
];

const SMTP_AUTH_HINTS = {
  brevo: { userLabel: 'Brevo account email', passLabel: 'SMTP key (xsmtpsib-...)', userPlaceholder: 'you@company.com' },
  sendgrid: { userLabel: 'SMTP login', passLabel: 'API key (SG....)', userDefault: 'apikey', userPlaceholder: 'apikey' },
  mailjet: { userLabel: 'API key', passLabel: 'Secret key', userPlaceholder: 'API key' },
  elasticemail: { userLabel: 'Elastic Email login', passLabel: 'API key', userPlaceholder: 'your@email.com' },
  smtp2go: { userLabel: 'SMTP2GO username', passLabel: 'SMTP2GO password' },
  mailersend: { userLabel: 'MailerSend SMTP user', passLabel: 'MailerSend SMTP password' },
  amazon_ses: { userLabel: 'SES SMTP username', passLabel: 'SES SMTP password' },
  mailgun: { userLabel: 'Mailgun SMTP login', passLabel: 'Mailgun SMTP password', userPlaceholder: 'postmaster@yourdomain.mailgun.org' },
  sparkpost: { userLabel: 'SparkPost SMTP user', passLabel: 'SparkPost SMTP password' },
  postmark: { userLabel: 'Postmark Server Token', passLabel: 'Postmark Server Token', userPlaceholder: 'Server API token' },
};

const credentialsMapToObject = (map) => {
  if (!map) return {};
  if (map instanceof Map) return Object.fromEntries(map.entries());
  return { ...map };
};

const { getEnvProviderCredential, getEnvConfiguredProviders } = require('./envProviderCredentials');

const resolveProviderAuth = (profile, providerKey) => {
  if (!profile || !providerKey) return null;

  // .env credentials take precedence when set (user updated server/.env)
  const envCred = getEnvProviderCredential(providerKey);
  if (envCred) {
    const creds = credentialsMapToObject(profile.providerCredentials);
    const extra = creds[providerKey];
    const hint = SMTP_AUTH_HINTS[providerKey];
    return {
      user: extra?.smtpUser || envCred.smtpUser || hint?.userDefault || profile.smtpUser,
      pass: envCred.smtpPass,
    };
  }

  const creds = credentialsMapToObject(profile.providerCredentials);
  const extra = creds[providerKey];
  if (extra?.smtpPass) {
    const hint = SMTP_AUTH_HINTS[providerKey];
    return {
      user: extra.smtpUser || hint?.userDefault || profile.smtpUser,
      pass: extra.smtpPass,
    };
  }
  const inferred = inferProviderFromEmail(profile.smtpUser || profile.email);
  if (providerKey === inferred && profile.smtpPass && profile.smtpPass !== 'unused') {
    return { user: profile.smtpUser, pass: profile.smtpPass };
  }
  return null;
};

/** Providers this profile can send through (must have credentials) */
const getProfileRotationProviders = (profile) => {
  if (!profile) return getEnvConfiguredProviders();
  const active = new Set();
  const creds = credentialsMapToObject(profile.providerCredentials);

  const inferred = inferProviderFromEmail(profile.smtpUser || profile.email);
  if (inferred && profile.smtpPass && profile.smtpPass !== 'unused') active.add(inferred);
  if (inferred && getEnvProviderCredential(inferred)) active.add(inferred);

  for (const key of ADDITIONAL_ROTATION_PROVIDERS) {
    const c = creds[key];
    if (c?.smtpPass && c.enabled !== false) active.add(key);
    else if (getEnvProviderCredential(key)) active.add(key);
  }

  for (const key of getEnvConfiguredProviders()) {
    active.add(key);
  }

  const list = [...active];
  if (profile.rotationProviders?.length) {
    return profile.rotationProviders.filter((k) => active.has(k));
  }
  return list;
};

const getDailyLimitForProvider = (providerType) =>
  SMTP_PRESETS[providerType]?.dailyLimit ?? SMTP_PRESETS.custom.dailyLimit;

const applySmtpPreset = (presetKey) => {
  const preset = SMTP_PRESETS[presetKey] || SMTP_PRESETS.custom;
  return {
    providerType: presetKey,
    smtpHost: preset.smtpHost,
    smtpPort: preset.smtpPort,
    dailyLimit: preset.dailyLimit,
  };
};

module.exports = {
  SMTP_PRESETS,
  FREE_ROTATION_PROVIDER_KEYS,
  ADDITIONAL_ROTATION_PROVIDERS,
  SMTP_AUTH_HINTS,
  getDailyLimitForProvider,
  applySmtpPreset,
  inferProviderFromEmail,
  getProfileRotationProviders,
  resolveProviderAuth,
  findProviderByHost,
  credentialsMapToObject,
};
