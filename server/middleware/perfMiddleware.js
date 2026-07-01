const logger = require('../utils/logger');

// ponytail: dashboard fan-out + cold Mongo on dev; 5s default = real regressions only
const SLOW_THRESHOLD_MS = Math.max(
  1000,
  Number.parseInt(process.env.SLOW_REQUEST_THRESHOLD_MS || '5000', 10) || 5000,
);

function perfMiddleware(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const elapsedNs = process.hrtime.bigint() - start;
    const durationMs = Number(elapsedNs) / 1e6;

    if (durationMs < SLOW_THRESHOLD_MS) return;

    logger.warn('perfMiddleware', 'Slow request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs),
      traceId: req.traceId,
      errorCode: 'SLOW_REQUEST',
    });
  });

  next();
}

module.exports = perfMiddleware;
module.exports.SLOW_THRESHOLD_MS = SLOW_THRESHOLD_MS;
