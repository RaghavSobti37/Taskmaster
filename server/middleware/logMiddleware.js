import Log from '../models/Log.js';

/**
 * Creates a log entry in the database
 * @param {string} level - Log level: 'info', 'warn', 'error'
 * @param {string} message - Log message
 * @param {string} source - Source of the log (e.g., 'auth', 'task', 'user')
 * @param {object} metadata - Additional metadata (optional)
 * @param {string} userId - User ID (optional)
 */
export const createLog = async (level, message, source, metadata = null, userId = null) => {
  try {
    const log = new Log({
      timestamp: new Date(),
      level,
      message,
      source,
      metadata,
      userId,
    });
    await log.save();
  } catch (error) {
    console.error('Error creating log:', error.message);
  }
};

/**
 * Middleware to log HTTP requests
 */
export const loggerMiddleware = async (req, res, next) => {
  // Log important API endpoints
  const importantEndpoints = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/tasks',
    '/api/users/team',
  ];

  if (importantEndpoints.some(endpoint => req.path.includes(endpoint))) {
    // Log after response is sent
    const originalSend = res.send;
    res.send = function (data) {
      const statusCode = res.statusCode;
      let level = 'info';
      let message = `${req.method} ${req.path}`;

      if (statusCode >= 400) {
        level = 'error';
      } else if (statusCode >= 300) {
        level = 'warn';
      }

      createLog(level, message, 'http', { method: req.method, path: req.path, status: statusCode }, req.user?._id);

      return originalSend.call(this, data);
    };
  }

  next();
};

export default createLog;
