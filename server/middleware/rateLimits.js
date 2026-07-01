const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { config } = require('../config');

const limitMessage = (message) => ({ ok: false, error: message });

const clientIpKey = (req) => ipKeyGenerator(req);

const authRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: config.isProduction ? 5 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: limitMessage('Too many auth requests. Try again in an hour.'),
  keyGenerator: (req) => {
    const email = req.body?.email;
    if (typeof email === 'string' && email.trim()) {
      return `auth:${email.trim().toLowerCase()}`;
    }
    return `auth-ip:${clientIpKey(req)}`;
  },
});

const searchRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: config.isProduction ? 30 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: limitMessage('Too many search requests. Slow down and try again.'),
  keyGenerator: (req) => {
    const userId = req.user?._id?.toString?.() || req.user?.id;
    if (userId) return `search:user:${userId}`;
    return `search-ip:${clientIpKey(req)}`;
  },
});

const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: config.isProduction ? 120 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: limitMessage('Too many webhook requests.'),
  keyGenerator: (req) => `webhook:${clientIpKey(req)}`,
});

const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: config.isProduction ? 40 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: limitMessage('Too many uploads. Try again later.'),
  keyGenerator: (req) => {
    const userId = req.user?._id?.toString?.() || req.user?.id;
    if (userId) return `upload:user:${userId}`;
    return `upload-ip:${clientIpKey(req)}`;
  },
});

module.exports = {
  authRateLimit,
  searchRateLimit,
  webhookRateLimit,
  uploadRateLimit,
};
