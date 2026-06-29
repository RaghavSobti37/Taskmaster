const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { protect, requireAnyPageAccess } = require('../middleware/authMiddleware');
const { handleProxyRequest } = require('../controllers/proxyController');

const proxyAccess = requireAnyPageAccess('finance', 'announcements', 'admin_data');

const proxyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 60 : 200,
  message: { error: 'Too many proxy requests, please try again later.' }
});

router.all('/:service', protect, proxyAccess, proxyLimiter, handleProxyRequest);
router.all('/:service/*', protect, proxyAccess, proxyLimiter, handleProxyRequest);

module.exports = router;
