import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logsDir = path.join(__dirname, '../logs');
const logsFile = path.join(logsDir, 'app.log');

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Writes a log entry to a local file
 * @param {string} level - Log level: 'info', 'warn', 'error'
 * @param {string} message - Log message
 * @param {string} source - Source of the log (e.g., 'auth', 'task', 'user')
 * @param {object} metadata - Additional metadata (optional)
 * @param {string} userId - User ID (optional)
 */
export const createLog = (level, message, source, metadata = null, userId = null) => {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      source,
      metadata,
      userId,
    };
    
    fs.appendFileSync(logsFile, JSON.stringify(logEntry) + '\n', 'utf8');
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
