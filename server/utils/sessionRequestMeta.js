const { extractClientIp, normalizeIp } = require('./geoLookup');

const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '0:0:0:0:0:0:0:1', 'unknown', '']);

const isLoopbackIp = (ip = '') => {
  const normalized = normalizeIp(ip);
  if (!normalized || LOOPBACK_IPS.has(normalized)) return true;
  return normalized.startsWith('127.') || normalized.endsWith('.127.0.0.1');
};

const parseDeviceLabel = (userAgent = '') => {
  const ua = String(userAgent);
  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';

  let os = 'Unknown OS';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return `${browser} on ${os}`;
};

/** Best-effort client IP — same chain as email geo (X-Forwarded-For, X-Real-IP, CF). */
const resolveClientIp = (req) => extractClientIp(req) || 'unknown';

/** Human-readable IP for session lists; hides loopback noise. */
const formatSessionIp = (ip = '') => {
  const normalized = normalizeIp(ip);
  if (!normalized || isLoopbackIp(normalized)) return null;
  return normalized;
};

const sessionMetaFromRequest = (req) => ({
  userAgent: req.headers['user-agent'] || 'Unknown',
  ip: resolveClientIp(req),
  label: parseDeviceLabel(req.headers['user-agent']),
});

/** Prefer a newly resolved IP when the stored value is loopback. */
const pickSessionIp = (storedIp, freshIp) => {
  const fresh = normalizeIp(freshIp);
  if (!fresh || isLoopbackIp(fresh)) return storedIp;
  if (!storedIp || isLoopbackIp(storedIp)) return fresh;
  return storedIp;
};

module.exports = {
  parseDeviceLabel,
  resolveClientIp,
  formatSessionIp,
  isLoopbackIp,
  pickSessionIp,
  sessionMetaFromRequest,
};
