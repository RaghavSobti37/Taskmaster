const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ALLOWED_DOMAIN = (process.env.ALLOWED_DOMAIN || '').trim().toLowerCase();

const isRegistrationAllowed = (emailLower) => {
  if (process.env.REGISTRATION_DISABLED === 'true' && process.env.NODE_ENV === 'production') {
    return { ok: false, error: 'Registration is disabled. Contact an administrator.' };
  }
  if (process.env.NODE_ENV !== 'production') return { ok: true };

  const domain = emailLower.split('@')[1] || '';
  if (ALLOWED_DOMAIN && domain !== ALLOWED_DOMAIN && emailLower !== ADMIN_EMAIL) {
    return { ok: false, error: 'Registration restricted to authorized email domain' };
  }
  return { ok: true };
};

/**
 * Domain-only establish gate (not org membership).
 * @param {{ email: string }} profile
 */
const assertEstablishAllowed = (profile) => {
  const emailLower = profile?.email?.toLowerCase?.().trim();
  if (!emailLower) {
    const err = new Error('Clerk account has no email');
    err.status = 400;
    throw err;
  }
  const allowed = isRegistrationAllowed(emailLower);
  if (!allowed.ok) {
    const err = new Error(allowed.error || 'Registration not allowed');
    err.status = 403;
    throw err;
  }
};

module.exports = {
  isRegistrationAllowed,
  assertEstablishAllowed,
};
