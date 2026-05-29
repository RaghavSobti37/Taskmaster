const SMTP_PRESETS = {
  gmail: { label: 'Gmail', smtpHost: 'smtp.gmail.com', smtpPort: 587, dailyLimit: 500 },
  outlook: { label: 'Outlook / Office 365', smtpHost: 'smtp.office365.com', smtpPort: 587, dailyLimit: 300 },
  yahoo: { label: 'Yahoo Mail', smtpHost: 'smtp.mail.yahoo.com', smtpPort: 465, dailyLimit: 500 },
  zoho: { label: 'Zoho Mail', smtpHost: 'smtp.zoho.com', smtpPort: 587, dailyLimit: 500 },
  brevo: { label: 'Brevo (Sendinblue)', smtpHost: 'smtp-relay.brevo.com', smtpPort: 587, dailyLimit: 300 },
  sendgrid: { label: 'SendGrid SMTP', smtpHost: 'smtp.sendgrid.net', smtpPort: 587, dailyLimit: 100 },
  resend: { label: 'Resend (API)', smtpHost: '', smtpPort: 587, dailyLimit: 100 },
  custom: { label: 'Custom SMTP', smtpHost: '', smtpPort: 587, dailyLimit: 500 },
};

const getDailyLimitForProvider = (providerType) =>
  SMTP_PRESETS[providerType]?.dailyLimit ?? SMTP_PRESETS.custom.dailyLimit;

module.exports = { SMTP_PRESETS, getDailyLimitForProvider };
