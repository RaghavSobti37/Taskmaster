const express = require('express');
const router = express.Router();
const { getOfferings, getConfigStatus, syncExlyData, handleExlyWebhook, getOfferingDetails, updateOffering, getDashboardStats } = require('../controllers/exlyController');
const { protect, admin } = require('../middleware/authMiddleware');

// Public Webhook for Pabbly Connect / Zapier
router.post('/webhook', handleExlyWebhook);

router.get('/dashboard-stats', protect, admin, getDashboardStats);
router.get('/offerings', protect, admin, getOfferings);
router.get('/offerings/:offeringId', protect, admin, getOfferingDetails);
router.put('/offerings/:offeringId', protect, admin, updateOffering);
router.get('/config', protect, admin, getConfigStatus);
router.post('/sync', protect, admin, syncExlyData);

module.exports = router;
