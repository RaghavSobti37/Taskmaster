const express = require('express');
const router = express.Router();
const {
  getOfferings,
  getConfigStatus,
  syncExlyData,
  handleExlyWebhook,
  getOfferingDetails,
  getOfferingAnalytics,
  updateOffering,
  getDashboardStats,
  getMasterclassFunnel,
  getUnlinkedBookings,
  linkUnlinkedBookings,
} = require('./controllers/exlyController');
const { protect, requirePageAccess } = require('../../middleware/authMiddleware');

const exlyAccess = requirePageAccess('admin_exly');

router.post('/webhook', handleExlyWebhook);

router.get('/dashboard-stats', protect, exlyAccess, getDashboardStats);
router.get('/masterclass-funnel', protect, exlyAccess, getMasterclassFunnel);
router.get('/unlinked-bookings', protect, exlyAccess, getUnlinkedBookings);
router.post('/unlinked-bookings/link', protect, exlyAccess, linkUnlinkedBookings);
router.get('/offerings', protect, exlyAccess, getOfferings);
router.get('/offerings/:offeringId', protect, exlyAccess, getOfferingDetails);
router.get('/offerings/:offeringId/analytics', protect, exlyAccess, getOfferingAnalytics);
router.put('/offerings/:offeringId', protect, exlyAccess, updateOffering);
router.get('/config', protect, exlyAccess, getConfigStatus);
router.post('/sync', protect, exlyAccess, syncExlyData);

module.exports = router;
