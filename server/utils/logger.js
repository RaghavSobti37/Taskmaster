/**
 * Centralized structured logger for production code.
 * Replaces raw console.* calls with tagged, level-aware logging.
 * Optional meta.persist writes to SystemLog collection.
 */
const { SEVERITY, MODULE } = require('../../shared/systemLogContract');

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'] ?? LOG_LEVELS.info;

const formatMessage = (level, tag, message, meta) => {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} [${level.toUpperCase()}] [${tag}] ${message}${metaStr}`;
};

const severityFromLevel = {
  error: SEVERITY.ERROR,
  warn: SEVERITY.WARN,
  info: SEVERITY.INFO,
  debug: SEVERITY.INFO,
};

function maybePersist(level, tag, message, meta) {
  if (!meta?.persist) return;
  const { writeSystemLog } = require('../services/systemLogService');
  const severity = meta.severity || severityFromLevel[level] || SEVERITY.INFO;
  writeSystemLog({
    severity,
    module: meta.module || MODULE.SYSTEM,
    message: typeof message === 'string' ? message : tag,
    userVisible: Boolean(meta.userVisible),
    payload: meta.payload || (meta && Object.keys(meta).length ? meta : undefined),
    route: meta.route,
    errorCode: meta.errorCode,
    relatedEntities: meta.relatedEntities,
  });
}

const logger = {
  error: (tag, message, meta) => {
    if (currentLevel >= LOG_LEVELS.error) {
      console.error(formatMessage('error', tag, message, meta));
    }
    maybePersist('error', tag, message, meta);
  },
  warn: (tag, message, meta) => {
    if (currentLevel >= LOG_LEVELS.warn) {
      console.warn(formatMessage('warn', tag, message, meta));
    }
    maybePersist('warn', tag, message, meta);
  },
  info: (tag, message, meta) => {
    if (currentLevel >= LOG_LEVELS.info) {
      console.log(formatMessage('info', tag, message, meta));
    }
    maybePersist('info', tag, message, meta);
  },
  debug: (tag, message, meta) => {
    if (currentLevel >= LOG_LEVELS.debug) {
      console.log(formatMessage('debug', tag, message, meta));
    }
  },
};

module.exports = logger;
