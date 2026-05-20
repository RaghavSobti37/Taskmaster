const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const mailAnalyticsController = require('../controllers/mailAnalyticsController');
const { protect } = require('../middleware/authMiddleware');

router.get('/cumulative', protect, analyticsController.getCumulativeMetrics);
router.get('/location-leads', protect, analyticsController.getLocationLeads);
router.get('/geo-campaign', protect, mailAnalyticsController.getGeoCampaignAnalytics);

module.exports = router;
