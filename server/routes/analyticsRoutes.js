const express = require('express');
const router = express.Router();
const dashboardMetricsController = require('../domains/dashboard/controllers/dashboardMetricsController');
const mailAnalyticsController = require('../domains/mail/controllers/mailAnalyticsController');
const { protect } = require('../middleware/authMiddleware');
const { getTenantId } = require('../utils/tenantContext');
const { comparePeriods } = require('../services/analytics/comparisonEngine');
const { getSparkline } = require('../services/analytics/sparklineService');
const logger = require('../utils/logger');

router.get('/cumulative', protect, dashboardMetricsController.getCumulativeMetrics);
router.get('/location-leads', protect, dashboardMetricsController.getLocationLeads);
router.get('/geo-campaign', protect, mailAnalyticsController.getGeoCampaignAnalytics);

router.get('/compare', protect, async (req, res) => {
  try {
    const { metric, currentStart, currentEnd, previousStart, previousEnd } = req.query;
    if (!metric || !currentStart || !currentEnd || !previousStart || !previousEnd) {
      return res.status(400).json({
        error: 'metric, currentStart, currentEnd, previousStart, previousEnd are required',
      });
    }

    const tenantId = getTenantId() || req.user?.tenantId;
    const result = await comparePeriods({
      metric,
      tenantId,
      currentPeriod: { start: new Date(currentStart), end: new Date(currentEnd) },
      previousPeriod: { start: new Date(previousStart), end: new Date(previousEnd) },
    });

    res.json(result);
  } catch (error) {
    logger.error('analyticsRoutes', 'compare', { error: error.message || error });
    res.status(error.message?.startsWith('Unknown metric') ? 400 : 500).json({ error: error.message });
  }
});

router.get('/sparkline', protect, async (req, res) => {
  try {
    const { metric, days } = req.query;
    if (!metric) return res.status(400).json({ error: 'metric is required' });

    const tenantId = getTenantId() || req.user?.tenantId;
    const result = await getSparkline(metric, tenantId, parseInt(days, 10) || 7);
    res.json(result);
  } catch (error) {
    logger.error('analyticsRoutes', 'sparkline', { error: error.message || error });
    res.status(error.message?.startsWith('Unknown metric') ? 400 : 500).json({ error: error.message });
  }
});

module.exports = router;
