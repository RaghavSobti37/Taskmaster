const rateLimit = require('express-rate-limit');
const { config } = require('../config');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.NODE_ENV === 'production' ? 1000 : 2000,
});

const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.NODE_ENV === 'production' ? 300 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many tracking requests, please try again later.' },
});

function isTrackingPath(path = '') {
  return (
    path.startsWith('/open/')
    || path.startsWith('/click/')
    || path === '/unsubscribe'
    || path.startsWith('/webhooks/')
    || path.startsWith('/api/track')
  );
}

function applyRateLimits(app) {
  app.use('/api/', apiLimiter);
  app.use((req, res, next) => {
    if (isTrackingPath(req.path || '')) {
      return trackLimiter(req, res, next);
    }
    return next();
  });
}

module.exports = {
  apiLimiter,
  trackLimiter,
  isTrackingPath,
  applyRateLimits,
};
