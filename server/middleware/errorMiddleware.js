const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  
  // Structured error logging
  const errorLog = {
    timestamp: new Date().toISOString(),
    route: req.originalUrl,
    method: req.method,
    userId: req.user ? req.user._id : 'unauthenticated',
    error: err.message,
    stack: err.stack
  };
  
  console.error('[ERROR_MIDDLEWARE]', JSON.stringify(errorLog, null, 2));

  res.status(statusCode).json({
    error: err.message || 'Internal Server Error',
    code: err.name || 'ServerError',
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
    details: process.env.NODE_ENV === 'production' ? null : err.stack
  });
};

module.exports = errorHandler;
