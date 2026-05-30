/** Free / freemium SMTP providers suitable for rotation pools */
export const SMTP_PRESETS = {
  gmail: { label: 'Gmail', smtpHost: 'smtp.gmail.com', smtpPort: 587, dailyLimit: 500 },
  outlook: { label: 'Outlook / Office 365', smtpHost: 'smtp.office365.com', smtpPort: 587, dailyLimit: 300 },
  yahoo: { label: 'Yahoo Mail', smtpHost: 'smtp.mail.yahoo.com', smtpPort: 465, dailyLimit: 500 },
  aol: { label: 'AOL Mail', smtpHost: 'smtp.aol.com', smtpPort: 465, dailyLimit: 500 },
  zoho: { label: 'Zoho Mail', smtpHost: 'smtp.zoho.com', smtpPort: 587, dailyLimit: 500 },
  icloud: { label: 'iCloud Mail', smtpHost: 'smtp.mail.me.com', smtpPort: 587, dailyLimit: 1000 },
  gmx: { label: 'GMX Mail', smtpHost: 'mail.gmx.com', smtpPort: 587, dailyLimit: 50 },
  brevo: { label: 'Brevo (Sendinblue)', smtpHost: 'smtp-relay.brevo.com', smtpPort: 587, dailyLimit: 300 },
  sendgrid: { label: 'SendGrid SMTP', smtpHost: 'smtp.sendgrid.net', smtpPort: 587, dailyLimit: 100 },
  mailjet: { label: 'Mailjet', smtpHost: 'in-v3.mailjet.com', smtpPort: 587, dailyLimit: 200 },
  elasticemail: { label: 'Elastic Email', smtpHost: 'smtp.elasticemail.com', smtpPort: 2525, dailyLimit: 100 },
  mailgun: { label: 'Mailgun', smtpHost: 'smtp.mailgun.org', smtpPort: 587, dailyLimit: 10 },
  amazon_ses: { label: 'Amazon SES', smtpHost: 'email-smtp.us-east-1.amazonaws.com', smtpPort: 587, dailyLimit: 200 },
  mailersend: { label: 'MailerSend', smtpHost: 'smtp.mailersend.net', smtpPort: 587, dailyLimit: 17 },
  smtp2go: { label: 'SMTP2GO', smtpHost: 'mail.smtp2go.com', smtpPort: 2525, dailyLimit: 33 },
  sparkpost: { label: 'SparkPost', smtpHost: 'smtp.sparkpostmail.com', smtpPort: 587, dailyLimit: 17 },
  postmark: { label: 'Postmark', smtpHost: 'smtp.postmarkapp.com', smtpPort: 587, dailyLimit: 100 },
  resend: { label: 'Resend (API)', smtpHost: '', smtpPort: 587, dailyLimit: 100 },
  custom: { label: 'Custom SMTP', smtpHost: '', smtpPort: 587, dailyLimit: 500 },
};

export const FREE_ROTATION_PROVIDER_KEYS = Object.keys(SMTP_PRESETS).filter(
  (key) => key !== 'custom' && key !== 'resend' && SMTP_PRESETS[key].smtpHost
);

const DOMAIN_PROVIDER_RULES = [
  { pattern: /@(gmail|googlemail)\.com$/i, provider: 'gmail' },
  { pattern: /@(outlook|hotmail|live|msn)\.com$/i, provider: 'outlook' },
  { pattern: /@(yahoo|ymail)\.com$/i, provider: 'yahoo' },
  { pattern: /@aol\.com$/i, provider: 'aol' },
  { pattern: /@zoho\.com$/i, provider: 'zoho' },
  { pattern: /@(icloud|me|mac)\.com$/i, provider: 'icloud' },
  { pattern: /@gmx\.(com|net|de)$/i, provider: 'gmx' },
];

export const inferProviderFromEmail = (email) => {
  const addr = (email || '').trim().toLowerCase();
  if (!addr.includes('@')) return null;
  for (const { pattern, provider } of DOMAIN_PROVIDER_RULES) {
    if (pattern.test(addr)) return provider;
  }
  return null;
};

export const ADDITIONAL_ROTATION_PROVIDERS = [
  'brevo', 'sendgrid', 'mailjet', 'elasticemail', 'smtp2go',
  'mailersend', 'amazon_ses', 'mailgun', 'sparkpost', 'postmark',
];

export const SMTP_AUTH_HINTS = {
  brevo: { userLabel: 'Brevo account email', passLabel: 'SMTP key (xsmtpsib-...)', userPlaceholder: 'you@company.com' },
  sendgrid: { userLabel: 'SMTP login', passLabel: 'API key (SG....)', userDefault: 'apikey', userPlaceholder: 'apikey' },
  mailjet: { userLabel: 'API key', passLabel: 'Secret key' },
  elasticemail: { userLabel: 'Elastic Email login', passLabel: 'API key' },
  smtp2go: { userLabel: 'SMTP2GO username', passLabel: 'SMTP2GO password' },
  mailersend: { userLabel: 'MailerSend SMTP user', passLabel: 'MailerSend SMTP password' },
  amazon_ses: { userLabel: 'SES SMTP username', passLabel: 'SES SMTP password' },
  mailgun: { userLabel: 'Mailgun SMTP login', passLabel: 'Mailgun SMTP password' },
  sparkpost: { userLabel: 'SparkPost SMTP user', passLabel: 'SparkPost SMTP password' },
  postmark: { userLabel: 'Postmark token', passLabel: 'Postmark token' },
};

const credsToObject = (map) => {
  if (!map) return {};
  if (map instanceof Map) return Object.fromEntries(map.entries());
  return { ...map };
};

export const getProfileRotationProviders = (profile) => {
  if (!profile) return [];
  const active = [];
  const creds = credsToObject(profile.providerCredentials);
  const inferred = inferProviderFromEmail(profile.smtpUser || profile.email);
  if (inferred && profile.smtpPass && profile.smtpPass !== 'unused') active.push(inferred);
  for (const key of ADDITIONAL_ROTATION_PROVIDERS) {
    const c = creds[key];
    if (c?.smtpPass && c.enabled !== false) active.push(key);
  }
  return active;
};

export const emptyProviderCredentials = () =>
  Object.fromEntries(
    ADDITIONAL_ROTATION_PROVIDERS.map((k) => [
      k,
      { smtpUser: SMTP_AUTH_HINTS[k]?.userDefault || '', smtpPass: '', enabled: false },
    ])
  );

export const SIGNATURE_START = '<!-- TASKMASTER_SIGNATURE_START -->';
export const SIGNATURE_END = '<!-- TASKMASTER_SIGNATURE_END -->';

export const applySmtpPreset = (presetKey) => {
  const preset = SMTP_PRESETS[presetKey] || SMTP_PRESETS.custom;
  return {
    providerType: presetKey,
    smtpHost: preset.smtpHost,
    smtpPort: preset.smtpPort,
    dailyLimit: preset.dailyLimit,
  };
};

const SIGNATURE_MARKER_BLOCK_RE = new RegExp(
  `${SIGNATURE_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${SIGNATURE_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
  'gi'
);

const DATA_ATTR_SIG_RE = /<div[^>]*data-taskmaster-signature\s*=\s*["']?true["']?[^>]*>[\s\S]*?<\/div>/gi;

export const countSignatureBlocks = (html) => {
  if (!html) return 0;
  const markerCount = (html.match(SIGNATURE_MARKER_BLOCK_RE) || []).length;
  if (markerCount > 0) return markerCount;
  return (html.match(DATA_ATTR_SIG_RE) || []).length;
};

export const hasSignatureBlock = (html) => countSignatureBlocks(html) > 0;

export const stripSignature = (html) => {
  if (!html) return '';
  let result = html.replace(SIGNATURE_MARKER_BLOCK_RE, '');
  result = result.replace(DATA_ATTR_SIG_RE, '');
  result = result.replace(/(<br\s*\/?>\s*){2,}$/i, '');
  return result.trimEnd();
};

export const wrapSignatureBlock = (signature) => {
  if (!signature?.trim()) return '';
  const trimmed = signature.trim();
  if (hasSignatureBlock(trimmed)) return trimmed;
  const body = trimmed.includes('data-taskmaster-signature=')
    ? trimmed
    : `<div data-taskmaster-signature="true">${trimmed}</div>`;
  return `${SIGNATURE_START}\n${body}\n${SIGNATURE_END}`;
};

export const appendSignature = (html, signature) => {
  const block = wrapSignatureBlock(signature);
  if (!block) return html || '';

  const base = stripSignature(html || '');
  if (/<\/body>/i.test(base)) {
    return base.replace(/<\/body>/i, `\n${block}\n</body>`);
  }
  if (/<\/html>/i.test(base)) {
    return base.replace(/<\/html>/i, `\n${block}\n</html>`);
  }
  return base ? `${base}\n<br/><br/>\n${block}` : block;
};

export const syncSignatureInContent = (html, signature, include) => {
  if (!include) return stripSignature(html);
  return appendSignature(html, signature);
};

export const estimateJsonBytes = (obj) => {
  try {
    return new Blob([JSON.stringify(obj)]).size;
  } catch {
    return JSON.stringify(obj).length;
  }
};

export const PAYLOAD_SAFE_BYTES = 3 * 1024 * 1024;
