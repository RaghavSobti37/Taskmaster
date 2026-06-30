const logger = require('../utils/logger');
const { captureException: capturePostHogException } = require('../utils/posthog');

const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;
  let errors = null;

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Mongoose Schema Validation Failed';
    errors = Object.values(err.errors).reduce((acc, current) => {
      acc[current.path] = current.message;
      return acc;
    }, {});
  }

  if (err.type === 'entity.too.large' || err.name === 'PayloadTooLargeError') {
    statusCode = 413;
    message = 'Request entity too large. Reduce HTML size, remove inline images, or upload attachments separately.';
  }

  const logMeta = {
    route: req.originalUrl,
    method: req.method,
    userId: req.user ? String(req.user._id) : 'unauthenticated',
    statusCode,
    traceId: req.traceId,
    error: message,
    errors,
  };

  if (statusCode >= 500) {
    logger.error('errorMiddleware', message, { ...logMeta, stack: err.stack });
    capturePostHogException(err, req, {
      route: req.originalUrl,
      method: req.method,
      statusCode,
    });
  } else {
    logger.warn('errorMiddleware', message, logMeta);
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    message,
    errors,
    code: err.name || 'ServerError',
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
    traceId: req.traceId,
    stack: process.env.NODE_ENV === 'production' ? null : (statusCode >= 500 ? err.stack : null),
  });
};

module.exports = errorHandler;
