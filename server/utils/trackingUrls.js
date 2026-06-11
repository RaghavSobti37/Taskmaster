const crypto = require('crypto');
const { getDbNameFromUri, isProdLikeDbName } = require('../config/database');

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
const DEFAULT_PUBLIC_TRACKING = 'https://YOUR-RENDER-SERVICE.onrender.com';

const resolveTrackingApiBaseUrl = () => {
  const explicit = (process.env.TRACKING_BASE_URL || '').trim().replace(/\/$/, '');
  if (explicit) return explicit;

  const appBase = (process.env.APP_BASE_URL || '').trim().replace(/\/$/, '');
  const useLocal = process.env.TRACKING_USE_LOCAL === 'true';
  const local = isLocalHostUrl(appBase);

  if (appBase && (!local || useLocal)) {
    return appBase;
  }

  if (useLocal) {
    const port = process.env.PORT || 5000;
    return appBase || `http://localhost:${port}`;
  }

  // Local dev + real inboxes: Gmail cannot reach localhost — use public API
  const fallback = (process.env.TRACKING_PUBLIC_FALLBACK || DEFAULT_PUBLIC_TRACKING).trim().replace(/\/$/, '');
  return fallback;
};

/** True when URI targets a non-production dev database (taskmaster_local, coreknot_local, etc.). */
const isLocalDevMongoUri = (uri = '') => {
  const trimmed = String(uri).trim();
  if (!trimmed) return false;
  if (/localhost|127\.0\.0\.1/i.test(trimmed)) return true;
  const name = getDbNameFromUri(trimmed).toLowerCase();
  if (!name) return false;
  if (isProdLikeDbName(name)) return false;
  return (
    name.includes('local')
    || name === 'testing'
    || name === 'coreknot'
    || name === 'taskmaster'
  );
};

/** Warn when tracking hits public API but EmailLog lives on a different DB. */
const getTrackingDbMismatchWarning = () => {
  if (process.env.MAIL_USE_PROD_DB === 'true' && process.env.MONGODB_URI_PROD) return null;

  const trackingBase = resolveTrackingApiBaseUrl();
  if (isLocalHostUrl(trackingBase)) return null;

  const dbUri = (process.env.MONGODB_URI || '').trim();
  const prodUri = (process.env.MONGODB_URI_PROD || '').trim();
  if (!dbUri || !prodUri || dbUri === prodUri) return null;
  if (isProdLikeDbName(getDbNameFromUri(dbUri))) return null;

  const localDb = isLocalDevMongoUri(dbUri);
  if (!localDb) return null;

  return (
    'Mail tracking URLs use a public API (' + trackingBase + ') but MONGODB_URI points to a local DB. ' +
    'Opens/clicks will not record. For local send tests, set MONGODB_URI to MONGODB_URI_PROD, ' +
    'or set TRACKING_USE_LOCAL=true and TRACKING_BASE_URL to an ngrok tunnel URL.'
  );
};

/** Static frontend unsubscribe page — user enters email on the page. */
const buildStaticUnsubscribePageUrl = () => {
  const frontend = (process.env.FRONTEND_URL || 'http://localhost:5173').trim().replace(/\/$/, '');
  return `${frontend}/unsubscribe`;
};

/** @deprecated Legacy per-recipient links — prefer buildStaticUnsubscribePageUrl */
const buildUnsubscribePageUrl = (campaignId, leadEmail, recipientId) => {
  const frontend = (process.env.FRONTEND_URL || 'http://localhost:5173').trim().replace(/\/$/, '');
  const { getJwtSecretForHmac } = require('./jwtSecret');
  const token = crypto
    .createHmac('sha256', getJwtSecretForHmac())
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
  buildStaticUnsubscribePageUrl,
  buildUnsubscribePageUrl,
  shouldSkipClickWrap,
  isLocalHostUrl,
  getTrackingDbMismatchWarning,
  isLocalDevMongoUri,
  DEFAULT_PUBLIC_TRACKING,
};
