import { logger } from '../utils/logger.js';

/**
 * Central error handler middleware
 * Must be added LAST in server.js after all other middleware and routes
 */
export const errorHandler = (err, req, res, next) => {
  const timestamp = new Date().toISOString();
  const requestId = req.id || 'unknown';
  const userId = req.user?.id || 'anonymous';
  
  // Default error properties
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';
  let errorType = err.errorType || 'UnhandledError';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorType = 'ValidationError';
    message = 'Validation failed: ' + Object.values(err.errors).map(e => e.message).join(', ');
  } else if (err.name === 'CastError') {
    statusCode = 400;
    errorType = 'CastError';
    message = 'Invalid ID format';
  } else if (err.code === 11000) {
    statusCode = 409;
    errorType = 'DuplicateKeyError';
    message = `Duplicate field: ${Object.keys(err.keyPattern)[0]}`;
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorType = 'JWTError';
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorType = 'TokenExpiredError';
    message = 'Token expired';
  }

  // Log the error
  logger.error(
    `${errorType}: ${message}`,
    'ERROR_HANDLER',
    {
      statusCode,
      errorType,
      path: req.path,
      method: req.method,
      requestId,
      originalError: err.message,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('user-agent')
    },
    userId
  );

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      errorType,
      requestId,
      timestamp,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};

/**
 * Async route handler wrapper to catch errors
 * Usage: router.post('/route', asyncHandler(async (req, res) => { ... }))
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Not found handler
 */
export const notFoundHandler = (req, res) => {
  const requestId = req.id || 'unknown';
  
  logger.warn(
    'Route not found',
    'NOT_FOUND',
    {
      path: req.path,
      method: req.method,
      requestId,
      ip: req.ip
    }
  );

  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
      requestId,
      path: req.path,
      method: req.method
    }
  });
};
