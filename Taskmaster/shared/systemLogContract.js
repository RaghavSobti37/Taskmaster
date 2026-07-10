/** Unified system log + toast severity levels */
const SEVERITY = Object.freeze({
  INFO: 'INFO',
  SUCCESS: 'SUCCESS',
  WARN: 'WARN',
  ERROR: 'ERROR',
});

/** Business module / scope identifiers */
const MODULE = Object.freeze({
  CRM: 'CRM',
  ATTENDANCE: 'ATTENDANCE',
  FINANCE: 'FINANCE',
  PROJECTS: 'PROJECTS',
  EMAIL: 'EMAIL',
  AUTH: 'AUTH',
  SYSTEM: 'SYSTEM',
  BACKUP: 'BACKUP',
  WEBHOOK: 'WEBHOOK',
});

const SEVERITY_VALUES = Object.values(SEVERITY);
const MODULE_VALUES = Object.values(MODULE);

/** Map API route prefixes to modules */
const ROUTE_MODULE_MAP = [
  { prefix: '/api/leads', module: MODULE.CRM },
  { prefix: '/api/crm', module: MODULE.CRM },
  { prefix: '/api/exly', module: MODULE.CRM },
  { prefix: '/api/attendance', module: MODULE.ATTENDANCE },
  { prefix: '/api/finance', module: MODULE.FINANCE },
  { prefix: '/api/projects', module: MODULE.PROJECTS },
  { prefix: '/api/tasks', module: MODULE.PROJECTS },
  { prefix: '/api/mail', module: MODULE.EMAIL },
  { prefix: '/api/campaigns', module: MODULE.EMAIL },
  { prefix: '/api/ses', module: MODULE.EMAIL },
  { prefix: '/api/auth', module: MODULE.AUTH },
  { prefix: '/api/webhooks', module: MODULE.WEBHOOK },
  { prefix: '/api/notifications', module: MODULE.SYSTEM },
  { prefix: '/api/backup', module: MODULE.BACKUP },
];

function inferModuleFromRoute(url = '') {
  const path = (url || '').split('?')[0];
  const match = ROUTE_MODULE_MAP.find(({ prefix }) => path.startsWith(prefix));
  return match ? match.module : MODULE.SYSTEM;
}

function isValidSeverity(value) {
  return SEVERITY_VALUES.includes(value);
}

function isValidModule(value) {
  return MODULE_VALUES.includes(value);
}

const SEVERITY_ALIASES = Object.freeze({
  success: SEVERITY.SUCCESS,
  error: SEVERITY.ERROR,
  warning: SEVERITY.WARN,
  warn: SEVERITY.WARN,
  info: SEVERITY.INFO,
});

function normalizeSeverity(value, fallback = SEVERITY.INFO) {
  if (!value) return fallback;
  const upper = String(value).toUpperCase();
  if (isValidSeverity(upper)) return upper;
  const alias = SEVERITY_ALIASES[String(value).toLowerCase()];
  return alias || fallback;
}

/** Deterministic toast id from module + message snippet */
function makeToastId(module, message, severity) {
  const parts = [module, severity, String(message || '').slice(0, 80)];
  return parts
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

/**
 * Normalize a raw emit payload to the shared contract shape.
 * @returns {Object} id, severity, module, message, title, description, payload, traceId, ...
 */
function normalizeSystemEventEntry(entry = {}) {
  const severity = normalizeSeverity(entry.severity || entry.type, SEVERITY.INFO);
  const route = entry.route || (typeof window !== 'undefined' ? window.location.pathname : undefined);
  const module = isValidModule(entry.module)
    ? entry.module
    : inferModuleFromRoute(entry.route || entry.url) || MODULE.SYSTEM;
  const message = String(entry.message || entry.title || 'Notification').trim() || 'Notification';
  const title = entry.title || message;
  const description =
    entry.description ||
    (typeof entry.payload?.description === 'string' ? entry.payload.description : undefined) ||
    (entry.message && entry.message !== entry.title ? entry.message : undefined);
  const technicalError =
    entry.technicalError ||
    entry.payload?.stack ||
    entry.payload?.technical ||
    (typeof entry.payload?.technicalError === 'string' ? entry.payload.technicalError : undefined) ||
    null;
  const payload = {
    ...(entry.payload && typeof entry.payload === 'object' ? entry.payload : {}),
    description: description || undefined,
    stack: technicalError || entry.payload?.stack || undefined,
    technical: technicalError || entry.payload?.technical || undefined,
  };
  const id = entry.id || entry.toastId || makeToastId(module, message, severity);

  return {
    id,
    severity,
    module,
    message,
    title,
    description: description && description !== title ? description : undefined,
    payload,
    technicalError,
    userVisible: entry.userVisible !== false,
    traceId: entry.traceId,
    contextId: entry.contextId,
    timestamp: entry.timestamp || new Date().toISOString(),
    route,
    errorCode: entry.errorCode,
    status: entry.status,
    httpStatus: entry.httpStatus || entry.status,
    duration: entry.duration,
    relatedEntities: entry.relatedEntities,
    customRender: entry.customRender,
  };
}

/** Default toast durations (ms) by severity */
const TOAST_DURATION = Object.freeze({
  [SEVERITY.SUCCESS]: 4000,
  [SEVERITY.WARN]: 5000,
  [SEVERITY.INFO]: 5000,
  [SEVERITY.ERROR]: Infinity,
});

/**
 * @typedef {Object} SystemLogEntry
 * @property {string} timestamp
 * @property {string} traceId
 * @property {string} [contextId]
 * @property {string} severity
 * @property {string} module
 * @property {string} message
 * @property {boolean} [userVisible]
 * @property {string} [actorId]
 * @property {string} [actorName]
 * @property {string} [tenantId]
 * @property {string} [route]
 * @property {string} [method]
 * @property {number} [httpStatus]
 * @property {string} [errorCode]
 * @property {Object} [payload]
 * @property {Array<{type: string, id: string}>} [relatedEntities]
 */

function buildErrorCopyText({
  title,
  description,
  technicalError,
  errorCode,
  status,
  traceId,
  module,
  timestamp,
  severity,
}) {
  const lines = [];
  if (timestamp) lines.push(`Timestamp: ${timestamp}`);
  if (traceId) lines.push(`TraceID: ${traceId}`);
  if (module) lines.push(`Module: ${module}`);
  if (severity) lines.push(`Severity: ${severity}`);
  if (title) lines.push(`Error: ${title}`);
  if (description && description !== title) lines.push(`Message: ${description}`);
  if (errorCode) lines.push(`Code: ${errorCode}`);
  if (status) lines.push(`HTTP: ${status}`);
  if (technicalError) {
    lines.push('', '--- Details ---', technicalError);
  }
  return lines.join('\n').trim() || 'Unknown error';
}

module.exports = {
  SEVERITY,
  MODULE,
  SEVERITY_VALUES,
  MODULE_VALUES,
  ROUTE_MODULE_MAP,
  TOAST_DURATION,
  inferModuleFromRoute,
  isValidSeverity,
  isValidModule,
  normalizeSeverity,
  makeToastId,
  normalizeSystemEventEntry,
  buildErrorCopyText,
};
