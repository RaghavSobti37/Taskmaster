const { logFromError } = require('../services/systemLogService');

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

  const errorLog = {
    timestamp: new Date().toISOString(),
    route: req.originalUrl,
    method: req.method,
    userId: req.user ? req.user._id : 'unauthenticated',
    error: message,
    errors,
    status: statusCode,
    traceId: req.traceId,
  };

  if (statusCode >= 500) {
    errorLog.stack = err.stack;
    console.error('[ERROR_MIDDLEWARE] Server Error:', JSON.stringify(errorLog, null, 2));
  } else {
    console.log(`[CLIENT_ERROR] Route: ${req.method} ${req.originalUrl} | Status: ${statusCode} | Message: ${message}`);
  }

  logFromError(req, err, {
    statusCode,
    userVisible: true,
  });

  res.status(statusCode).json({
    success: false,
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
