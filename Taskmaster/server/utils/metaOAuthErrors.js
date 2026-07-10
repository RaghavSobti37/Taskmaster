/**
 * Meta OAuth error helpers — authorization codes are single-use.
 */

function isMetaOAuthCodeUsedError(err) {
  const msg = String(
    err?.response?.data?.error?.message || err?.message || ''
  ).toLowerCase();
  return msg.includes('authorization code has been used')
    || msg.includes('code has been used');
}

function hasActiveMetaConnection(credentials) {
  if (!credentials) return false;
  const token = credentials.accessToken;
  const igAccountId = credentials.igAccountId;
  if (!token || !igAccountId) return false;

  const expiry = credentials.tokenExpiry ? new Date(credentials.tokenExpiry) : null;
  if (expiry && expiry.getTime() <= Date.now()) return false;

  return true;
}

module.exports = {
  isMetaOAuthCodeUsedError,
  hasActiveMetaConnection,
};
