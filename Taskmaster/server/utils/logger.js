/**
 * Structured JSON logger (Pino) — stdout only for Render log capture.
 */
const pino = require('pino');

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'info');

const root = pino({
  level,
  base: {
    service: process.env.SERVICE_NAME || 'coreknot-api',
    env: process.env.NODE_ENV || 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
});

function mergeMeta(tag, message, meta) {
  const out = { tag, msg: typeof message === 'string' ? message : String(message) };
  if (meta && typeof meta === 'object') Object.assign(out, meta);
  return out;
}

const logger = {
  error: (tag, message, meta) => root.error(mergeMeta(tag, message, meta)),
  warn: (tag, message, meta) => root.warn(mergeMeta(tag, message, meta)),
  info: (tag, message, meta) => root.info(mergeMeta(tag, message, meta)),
  debug: (tag, message, meta) => root.debug(mergeMeta(tag, message, meta)),
  child: (bindings) => root.child(bindings),
};

module.exports = logger;
