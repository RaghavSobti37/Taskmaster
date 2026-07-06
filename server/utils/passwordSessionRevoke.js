const { getTokenFromRequest } = require('./authCookie');
const { verifySessionToken } = require('./authSession');
const { revokeAllUserSessions, revokeOtherUserSessions } = require('./sessionRegistry');

/** Keep current device session when user changes own password; revoke all when no session context. */
async function revokeSessionsOnPasswordChange(req, userId) {
  const uid = String(userId);
  const token = getTokenFromRequest(req);
  let keepJti = null;
  if (token) {
    try {
      const decoded = verifySessionToken(token);
      if (decoded?.id === uid) keepJti = decoded.jti || null;
    } catch {
      // ponytail: invalid token → full revoke
    }
  }
  if (keepJti) return revokeOtherUserSessions(uid, keepJti);
  return revokeAllUserSessions(uid);
}

module.exports = { revokeSessionsOnPasswordChange };
