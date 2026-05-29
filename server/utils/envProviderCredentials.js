/** Read SMTP credentials from server/.env — used when profile DB creds missing or stale */

const isMock = (val) => !val || val.includes('mock') || val === 'mock_pass' || val === 'mock_user';

const getEnvProviderCredential = (providerKey) => {
  switch (providerKey) {
    case 'gmail': {
      const user = process.env.EMAIL_ADDRESS || process.env.SMTP_USER;
      const pass = process.env.EMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD;
      if (user && pass && !isMock(pass)) return { smtpUser: user.trim(), smtpPass: pass.trim() };
      break;
    }
    case 'brevo': {
      const pass = process.env.BREVO_SMTP_KEY;
      const user = process.env.BREVO_SMTP_USER || process.env.EMAIL_ADDRESS || process.env.ADMIN_EMAIL;
      if (pass && user && !isMock(pass)) return { smtpUser: user.trim(), smtpPass: pass.trim() };
      break;
    }
    case 'sendgrid': {
      const pass = process.env.SENDGRID_API_KEY;
      if (pass && !isMock(pass)) return { smtpUser: 'apikey', smtpPass: pass.trim() };
      break;
    }
    case 'mailjet': {
      const user = process.env.MAILJET_API_KEY;
      const pass = process.env.MAILJET_SECRET_KEY;
      if (user && pass && !isMock(pass)) return { smtpUser: user.trim(), smtpPass: pass.trim() };
      break;
    }
    default:
      break;
  }
  return null;
};

const getEnvConfiguredProviders = () => {
  const keys = ['gmail', 'brevo', 'sendgrid', 'mailjet'];
  return keys.filter((k) => getEnvProviderCredential(k));
};

const isAuthError = (err) => {
  const msg = (err?.message || err?.response || '').toString().toLowerCase();
  return msg.includes('invalid login')
    || msg.includes('authentication failed')
    || msg.includes('535')
    || msg.includes('534')
    || msg.includes('auth');
};

module.exports = {
  getEnvProviderCredential,
  getEnvConfiguredProviders,
  isAuthError,
};
