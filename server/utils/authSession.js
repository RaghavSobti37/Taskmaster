const jwt = require('jsonwebtoken');
const { setAuthCookie } = require('./authCookie');
const { newJti } = require('./tokenRevocation');

/** Sliding inactivity window — renewed on activity (default 7 days). */
const inactivityExpiresIn = () => process.env.JWT_EXPIRES_IN || '7d';

/** Hard cap from original login — forces re-auth after this (default 30 days). */
const absoluteMaxMs = () => {
  const days = Number(process.env.JWT_ABSOLUTE_MAX_DAYS) || 30;
  return days * 24 * 60 * 60 * 1000;
};

/** Min interval between cookie re-issues to limit Set-Cookie churn across devices. */
const refreshMinMs = () => {
  const minutes = Number(process.env.JWT_REFRESH_MINUTES) || 60;
  return minutes * 60 * 1000;
};

const nowSec = () => Math.floor(Date.now() / 1000);

const resolveLoginAt = (decoded) => {
  if (decoded?.loginAt != null && Number.isFinite(decoded.loginAt)) {
    return decoded.loginAt;
  }
  if (decoded?.iat != null && Number.isFinite(decoded.iat)) {
    return decoded.iat;
  }
  return nowSec();
};

const isAbsoluteSessionExpired = (decoded) => {
  const loginAt = resolveLoginAt(decoded);
  return Date.now() - loginAt * 1000 > absoluteMaxMs();
};

/**
 * Issue a session JWT. `loginAt` is preserved across sliding refreshes;
 * omitted on fresh login to start the absolute 30-day window.
 */
const generateSessionToken = (userId, loginAt = null) => {
  const iat = nowSec();
  const sessionLoginAt = loginAt ?? iat;
  return jwt.sign(
    { id: userId, loginAt: sessionLoginAt, jti: newJti() },
    process.env.JWT_SECRET,
    { expiresIn: inactivityExpiresIn() },
  );
};

const verifySessionToken = (token) => jwt.verify(token, process.env.JWT_SECRET);

const shouldRefreshSession = (decoded) => {
  if (isAbsoluteSessionExpired(decoded)) return false;
  const issuedAtMs = decoded?.iat != null && Number.isFinite(decoded.iat)
    ? decoded.iat * 1000
    : Date.now();
  return Date.now() - issuedAtMs >= refreshMinMs();
};

/**
 * Re-issue cookie when due so active users stay signed in (sliding inactivity).
 * Returns absoluteExpired=true when the 30-day cap is reached.
 */
const refreshSessionIfDue = (res, decoded, req) => {
  if (isAbsoluteSessionExpired(decoded)) {
    return { refreshed: false, absoluteExpired: true };
  }
  if (!shouldRefreshSession(decoded)) {
    return { refreshed: false, absoluteExpired: false };
  }
  const token = generateSessionToken(decoded.id, resolveLoginAt(decoded));
  setAuthCookie(res, token, req);
  const newDecoded = verifySessionToken(token);
  return { refreshed: true, absoluteExpired: false, newDecoded };
};

/** Fresh login / register / OAuth — new absolute window + inactivity clock. */
const establishSession = (res, userId, req) => {
  const token = generateSessionToken(userId);
  setAuthCookie(res, token, req);
  return token;
};

module.exports = {
  inactivityExpiresIn,
  absoluteMaxMs,
  refreshMinMs,
  resolveLoginAt,
  isAbsoluteSessionExpired,
  generateSessionToken,
  verifySessionToken,
  shouldRefreshSession,
  refreshSessionIfDue,
  establishSession,
};
