import { logger } from '../utils/logger.js';

/**
 * Generate unique request ID
 */
const generateRequestId = () => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Request tracking middleware
 * Adds unique request ID and logs all incoming requests
 * Must be added EARLY in server.js (after body parsing)
 */
export const requestTracking = (req, res, next) => {
  // Add unique request ID
  req.id = generateRequestId();
  
  // Add request start time
  req.startTime = Date.now();
  
  // Log incoming request
  logger.debug(
    `Incoming ${req.method} request`,
    'REQUEST',
    {
      requestId: req.id,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      origin: req.get('origin'),
      referer: req.get('referer'),
      contentType: req.get('content-type')
    }
  );

  // Track response
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - req.startTime;
    
    logger.debug(
      `Response sent`,
      'RESPONSE',
      {
        requestId: req.id,
        path: req.path,
        method: req.method,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        contentLength: Buffer.byteLength(data || '')
      }
    );

    return originalSend.call(this, data);
  };

  next();
};

/**
 * CORS debugging middleware
 * Logs all CORS-related information
 */
export const corsDebug = (req, res, next) => {
  const origin = req.get('origin');
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',')
    : ['http://localhost:5173', 'http://localhost:5174', 'https://taskmaster-sand.vercel.app'];

  if (origin) {
    logger.debug(
      'CORS request detected',
      'CORS',
      {
        origin,
        isAllowed: allowedOrigins.includes(origin),
        allowedOrigins,
        method: req.method,
        requestId: req.id
      }
    );
  }

  next();
};

/**
 * Authentication tracking middleware
 * Logs all auth-related requests
 */
export const authDebug = (req, res, next) => {
  const authHeader = req.get('authorization');
  
  if (req.path.includes('/auth/') || authHeader) {
    logger.debug(
      'Authentication request',
      'AUTH_DEBUG',
      {
        path: req.path,
        method: req.method,
        hasAuthHeader: !!authHeader,
        authType: authHeader?.split(' ')[0] || 'none',
        requestId: req.id
      }
    );
  }

  next();
};

/**
 * Database operation timing middleware
 */
export const dbTiming = (req, res, next) => {
  const originalQuery = res.locals.query;
  
  res.locals.queryStart = Date.now();
  
  next();
};

/**
 * Environment info middleware
 * Logs environment configuration on startup
 */
export const logEnvironmentInfo = () => {
  const environment = {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT || 5000,
    mongoUri: process.env.MONGO_URI ? '***' : 'NOT SET',
    corsOrigins: process.env.CORS_ALLOWED_ORIGINS || 'DEFAULT',
    jwtSecret: process.env.JWT_SECRET ? '***' : 'NOT SET',
    debugMode: process.env.DEBUG === 'true'
  };

  logger.info(
    'Server configuration loaded',
    'STARTUP',
    environment
  );
};
