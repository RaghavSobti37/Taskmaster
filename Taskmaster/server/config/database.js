/**
 * MongoDB URI resolution and dev/prod safety checks.
 * See server/.env.example and docs/LOCAL_DEV_DATABASE.md
 */

const PROD_DB_NAME_MARKERS = ['production', 'prod'];

const getDbNameFromUri = (uri = '') => {
  const trimmed = String(uri).trim();
  if (!trimmed) return '';
  const withoutQuery = trimmed.split('?')[0];
  const segments = withoutQuery.split('/').filter(Boolean);
  const last = segments[segments.length - 1] || '';
  if (last.includes('@') || last.includes(':') && !last.includes('.')) return '';
  return last.trim();
};

const maskMongoUri = (uri = '') =>
  String(uri).replace(/\/\/.*:.*@/, '//****:****@');

const resolveMongoUri = () => {
  const isProd = process.env.NODE_ENV === 'production';
  const isVercelPreview = process.env.VERCEL_ENV === 'preview';
  const vercelBranch = process.env.VERCEL_GIT_COMMIT_REF;

  let dbUri;
  let source = 'development';

  if (isVercelPreview && process.env.MONGODB_URI) {
    dbUri = process.env.MONGODB_URI.trim();
    source = 'vercel-preview';
    console.log(`[VERCEL PREVIEW] Using local MongoDB for branch: ${vercelBranch}`);
  } else if (isProd) {
    dbUri = (process.env.MONGODB_URI_PROD || process.env.MONGODB_URI || '').trim();
    source = 'production';
  } else {
    dbUri = (
      process.env.MONGODB_URI
      || process.env.MONGO_URI
      || 'mongodb://localhost:27017/testing'
    ).trim();
    source = 'development';
  }

  if (
    !isProd
    && !isVercelPreview
    && process.env.MAIL_USE_PROD_DB === 'true'
    && process.env.MONGODB_URI_PROD
  ) {
    dbUri = process.env.MONGODB_URI_PROD.trim();
    source = 'mail-prod-sync';
    console.log('[SYSTEM] MAIL_USE_PROD_DB=true — using production MongoDB for mail tracking sync');
    console.warn('[DATABASE] ⚠ MAIL_USE_PROD_DB forces ALL local API writes to production. Set false for normal dev.');
  }

  return { dbUri, source };
};

const isProdLikeDbName = (dbName = '') => {
  const lower = String(dbName).toLowerCase();
  return PROD_DB_NAME_MARKERS.some((marker) => lower.includes(marker));
};

/**
 * Warn or block connecting to production from local dev.
 * Set ALLOW_PROD_DB_IN_DEV=true to permit (e.g. MAIL_USE_PROD_DB workflows).
 */
const assertSafeDbTarget = (dbUri, context = {}) => {
  const { source = 'unknown' } = context;
  const isDevRuntime = process.env.NODE_ENV !== 'production' && process.env.VERCEL_ENV !== 'production';

  if (!isDevRuntime || source === 'production' || source === 'vercel-preview') {
    return;
  }

  const dbName = getDbNameFromUri(dbUri);
  if (!dbName || !isProdLikeDbName(dbName)) return;

  const allow = process.env.ALLOW_PROD_DB_IN_DEV === 'true';
  const message =
    `[DATABASE] Dev runtime is connecting to production-like database "${dbName}" ` +
    `(source: ${source}). Local test data may pollute production. ` +
    'Use MONGODB_URI ending in taskmaster_local. ' +
    'Set ALLOW_PROD_DB_IN_DEV=true only if intentional.';

  if (allow || source === 'mail-prod-sync') {
    console.warn('[DATABASE] ⚠ ' + message);
    return;
  }

  throw new Error(message);
};

const MONGOOSE_POOL_OPTIONS = Object.freeze({
  maxPoolSize: 20,
  minPoolSize: 5,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  heartbeatFrequencyMS: 10000,
});

const getMongooseConnectOptions = (overrides = {}) => ({
  ...MONGOOSE_POOL_OPTIONS,
  ...overrides,
});

module.exports = {
  getDbNameFromUri,
  maskMongoUri,
  resolveMongoUri,
  assertSafeDbTarget,
  isProdLikeDbName,
  MONGOOSE_POOL_OPTIONS,
  getMongooseConnectOptions,
};
