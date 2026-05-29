const crypto = require('crypto');

const isLocalHostUrl = (url = '') => {
  if (!url) return true;
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return url.includes('localhost') || url.includes('127.0.0.1');
  }
};

/** Public API origin for open pixel + click redirect routes (/api/track/...). */
const resolveTrackingApiBaseUrl = () => {
  const explicit = (process.env.TRACKING_BASE_URL || '').trim().replace(/\/$/, '');
  if (explicit) return explicit;

  const appBase = (process.env.APP_BASE_URL || '').trim().replace(/\/$/, '');
  const useLocal = process.env.TRACKING_USE_LOCAL === 'true';
  const local = isLocalHostUrl(appBase);

  if (appBase && (!local || useLocal)) {
    return appBase;
  }

  const port = process.env.PORT || 5000;
  return appBase || `http://localhost:${port}`;
};

/** Frontend unsubscribe page — never the API host. */
const buildUnsubscribePageUrl = (campaignId, leadEmail, recipientId) => {
  const frontend = (process.env.FRONTEND_URL || 'http://localhost:5173').trim().replace(/\/$/, '');
  const token = crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'fallback_secret')
    .update(String(leadEmail).toLowerCase().trim())
    .digest('hex');
  const params = new URLSearchParams({
    email: leadEmail,
    campaignId: String(campaignId),
    recipientId: String(recipientId),
    token
  });
  return `${frontend}/unsubscribe?${params.toString()}`;
};

const shouldSkipClickWrap = (url = '') => {
  if (!url) return true;
  const lower = url.toLowerCase();
  if (lower.includes('/api/track/')) return true;
  if (lower.includes('/unsubscribe')) return true;
  if (lower.startsWith('mailto:')) return true;
  if (lower.startsWith('tel:')) return true;
  if (lower.includes('{{unsubscribe')) return true;
  return false;
};

module.exports = {
  resolveTrackingApiBaseUrl,
  buildUnsubscribePageUrl,
  shouldSkipClickWrap,
  isLocalHostUrl
};
