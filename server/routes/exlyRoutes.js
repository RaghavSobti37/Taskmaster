const express = require('express');
const router = express.Router();
const { 
  getOfferings, getConfigStatus, syncExlyData, handleExlyWebhook, 
  getOfferingDetails, getOfferingAnalytics, updateOffering, getDashboardStats,
  getUnlinkedBookings, linkUnlinkedBookings
} = require('../controllers/exlyController');
const { protect, admin } = require('../middleware/authMiddleware');

// Public Webhook for Pabbly Connect / Zapier
router.post('/webhook', handleExlyWebhook);

router.get('/dashboard-stats', protect, admin, getDashboardStats);
router.get('/unlinked-bookings', protect, admin, getUnlinkedBookings);
router.post('/unlinked-bookings/link', protect, admin, linkUnlinkedBookings);
router.get('/offerings', protect, admin, getOfferings);
router.get('/offerings/:offeringId', protect, admin, getOfferingDetails);
router.get('/offerings/:offeringId/analytics', protect, admin, getOfferingAnalytics);
router.put('/offerings/:offeringId', protect, admin, updateOffering);
router.get('/config', protect, admin, getConfigStatus);
router.post('/sync', protect, admin, syncExlyData);

module.exports = router;

