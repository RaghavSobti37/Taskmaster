const express = require('express');
const router = express.Router();
const { getOfferings, getConfigStatus, syncExlyData, handleExlyWebhook } = require('../controllers/exlyController');
const { protect, admin } = require('../middleware/authMiddleware');

// Public Webhook for Pabbly Connect / Zapier
router.post('/webhook', handleExlyWebhook);

router.get('/offerings', protect, admin, getOfferings);
router.get('/config', protect, admin, getConfigStatus);
router.post('/sync', protect, admin, syncExlyData);

module.exports = router;
