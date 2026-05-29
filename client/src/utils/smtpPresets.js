export const SMTP_PRESETS = {
  gmail: { label: 'Gmail', smtpHost: 'smtp.gmail.com', smtpPort: 587, dailyLimit: 500 },
  outlook: { label: 'Outlook / Office 365', smtpHost: 'smtp.office365.com', smtpPort: 587, dailyLimit: 300 },
  yahoo: { label: 'Yahoo Mail', smtpHost: 'smtp.mail.yahoo.com', smtpPort: 465, dailyLimit: 500 },
  zoho: { label: 'Zoho Mail', smtpHost: 'smtp.zoho.com', smtpPort: 587, dailyLimit: 500 },
  brevo: { label: 'Brevo (Sendinblue)', smtpHost: 'smtp-relay.brevo.com', smtpPort: 587, dailyLimit: 300 },
  sendgrid: { label: 'SendGrid SMTP', smtpHost: 'smtp.sendgrid.net', smtpPort: 587, dailyLimit: 100 },
  resend: { label: 'Resend (API)', smtpHost: '', smtpPort: 587, dailyLimit: 100 },
  custom: { label: 'Custom SMTP', smtpHost: '', smtpPort: 587, dailyLimit: 500 },
};

export const applySmtpPreset = (presetKey) => {
  const preset = SMTP_PRESETS[presetKey] || SMTP_PRESETS.custom;
  return {
    providerType: presetKey,
    smtpHost: preset.smtpHost,
    smtpPort: preset.smtpPort,
    dailyLimit: preset.dailyLimit,
  };
};

export const appendSignature = (html, signature) => {
  if (!signature?.trim()) return html || '';
  const content = html || '';
  if (content.includes(signature)) return content;
  return content + (content ? '<br/><br/>' : '') + signature;
};

export const estimateJsonBytes = (obj) => {
  try {
    return new Blob([JSON.stringify(obj)]).size;
  } catch {
    return JSON.stringify(obj).length;
  }
};

export const PAYLOAD_SAFE_BYTES = 3 * 1024 * 1024;
