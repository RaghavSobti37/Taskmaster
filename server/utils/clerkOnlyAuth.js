const { isClerkConfigured } = require('./clerkAuth');

/** Production Clerk auth — legacy password/OAuth login routes disabled. */
const isClerkProductionAuth = () =>
  isClerkConfigured() && String(process.env.ALLOW_LEGACY_LOGIN || '').trim().toLowerCase() !== 'true';

class ClerkOnlyAuthError extends Error {
  constructor(message = 'Password login is disabled. Please sign in via SSO.') {
    super(message);
    this.status = 410;
    this.name = 'ClerkOnlyAuthError';
  }
}

const assertClerkOnlyAuth = () => {
  if (isClerkProductionAuth()) {
    throw new ClerkOnlyAuthError();
  }
};

const respondClerkOnlyAuth = (res) =>
  res.status(410).json({
    error: 'Password login is disabled. Please sign in at the auth host with Clerk.',
  });

module.exports = {
  isClerkProductionAuth,
  ClerkOnlyAuthError,
  assertClerkOnlyAuth,
  respondClerkOnlyAuth,
};
