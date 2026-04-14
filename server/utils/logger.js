import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logsDir = path.join(__dirname, '../logs');

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logsFile = path.join(logsDir, 'app.log');
const errorsFile = path.join(logsDir, 'errors.log');
const debugFile = path.join(logsDir, 'debug.log');

// Log levels
export const LOG_LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL'
};

// Enable debug mode via environment variable
const DEBUG_MODE = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';
const LOG_TO_CONSOLE = process.env.LOG_TO_CONSOLE !== 'false';
const ENVIRONMENT = process.env.NODE_ENV || 'development';

/**
 * Format log message with color codes for console (in dev mode)
 */
const getColorCode = (level) => {
  const colors = {
    DEBUG: '\x1b[36m',    // Cyan
    INFO: '\x1b[32m',     // Green
    WARN: '\x1b[33m',     // Yellow
    ERROR: '\x1b[31m',    // Red
    CRITICAL: '\x1b[35m'  // Magenta
  };
  return colors[level] || '';
};

const resetColor = '\x1b[0m';

/**
 * Core logger function
 */
const logMessage = (level, message, source = 'APP', metadata = null, userId = null) => {
  const timestamp = new Date().toISOString();
  const env = ENVIRONMENT;
  
  const logEntry = {
    timestamp,
    level,
    environment: env,
    source,
    message,
    metadata,
    userId,
    pid: process.pid
  };

  // Always write to main log file
  try {
    fs.appendFileSync(logsFile, JSON.stringify(logEntry) + '\n', 'utf8');
  } catch (error) {
    console.error('Failed to write to app.log:', error.message);
  }

  // Write errors to separate error log
  if ([LOG_LEVELS.ERROR, LOG_LEVELS.CRITICAL].includes(level)) {
    try {
      fs.appendFileSync(errorsFile, JSON.stringify(logEntry) + '\n', 'utf8');
    } catch (error) {
      console.error('Failed to write to errors.log:', error.message);
    }
  }

  // Write debug logs only if debug mode enabled
  if (DEBUG_MODE && level === LOG_LEVELS.DEBUG) {
    try {
      fs.appendFileSync(debugFile, JSON.stringify(logEntry) + '\n', 'utf8');
    } catch (error) {
      console.error('Failed to write to debug.log:', error.message);
    }
  }

  // Console output
  if (LOG_TO_CONSOLE) {
    const color = getColorCode(level);
    const prefix = `[${timestamp}] [${env.toUpperCase()}] [${level}] [${source}]`;
    const enhancedMessage = metadata 
      ? `${message} | ${JSON.stringify(metadata)}` 
      : message;
    
    console.log(`${color}${prefix}${resetColor} ${enhancedMessage}`);
  }
};

/**
 * Public logger API
 */
export const logger = {
  debug: (message, source = 'APP', metadata = null, userId = null) => {
    if (DEBUG_MODE) {
      logMessage(LOG_LEVELS.DEBUG, message, source, metadata, userId);
    }
  },

  info: (message, source = 'APP', metadata = null, userId = null) => {
    logMessage(LOG_LEVELS.INFO, message, source, metadata, userId);
  },

  warn: (message, source = 'APP', metadata = null, userId = null) => {
    logMessage(LOG_LEVELS.WARN, message, source, metadata, userId);
  },

  error: (message, source = 'APP', error = null, userId = null) => {
    const metadata = error ? {
      errorMessage: error.message,
      errorStack: error.stack,
      errorCode: error.code
    } : null;
    logMessage(LOG_LEVELS.ERROR, message, source, metadata, userId);
  },

  critical: (message, source = 'APP', error = null, userId = null) => {
    const metadata = error ? {
      errorMessage: error.message,
      errorStack: error.stack,
      errorCode: error.code
    } : null;
    logMessage(LOG_LEVELS.CRITICAL, message, source, metadata, userId);
  }
};

/**
 * Get current log configuration
 */
export const getLogConfig = () => ({
  debugMode: DEBUG_MODE,
  logToConsole: LOG_TO_CONSOLE,
  environment: ENVIRONMENT,
  logsDir,
  files: {
    appLog: logsFile,
    errorsLog: errorsFile,
    debugLog: debugFile
  }
});

export default logger;
