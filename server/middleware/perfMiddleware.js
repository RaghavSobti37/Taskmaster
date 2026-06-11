const logger = require('../utils/logger');
const { writeSystemLog } = require('../services/systemLogService');
const { SEVERITY, MODULE } = require('../../shared/systemLogContract');

const SLOW_THRESHOLD_MS = 500;

function perfMiddleware(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const elapsedNs = process.hrtime.bigint() - start;
    const durationMs = Number(elapsedNs) / 1e6;

    if (durationMs < SLOW_THRESHOLD_MS) return;

    const meta = {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs),
    };

    logger.warn('perfMiddleware', 'Slow request', meta);

    writeSystemLog({
      severity: SEVERITY.WARN,
      module: MODULE.SYSTEM,
      message: `Slow request ${meta.method} ${meta.path} (${meta.durationMs}ms)`,
      route: req.originalUrl,
      method: req.method,
      httpStatus: res.statusCode,
      errorCode: 'SLOW_REQUEST',
      payload: meta,
      userVisible: false,
    });
  });

  next();
}

module.exports = perfMiddleware;
module.exports.SLOW_THRESHOLD_MS = SLOW_THRESHOLD_MS;
