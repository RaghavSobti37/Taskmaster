const express = require('express');
const { protect, requirePageAccess } = require('../middleware/authMiddleware');
const { getCrmStatsReport, getCrmStatsTrends } = require('../services/crmDailyStatsService');
const { getDateKey } = require('../utils/attendanceDate');
const logger = require('../utils/logger');

const router = express.Router();
const adminDataAccess = requirePageAccess('admin_data');

router.use(protect, adminDataAccess);

router.get('/trends', async (req, res) => {
  try {
    const days = req.query.days ?? 30;
    const dateKey = req.query.dateKey || getDateKey();
    const data = await getCrmStatsTrends({ days, dateKey });
    res.json({ success: true, data });
  } catch (error) {
    logger.error('CrmStats', 'Trends fetch failed', { error: error.message });
    res.status(500).json({ success: false, message: error.message || 'Failed to load CRM trends' });
  }
});

router.get('/', async (req, res) => {
  try {
    const lookbackDays = req.query.days ?? req.query.lookbackDays ?? 1;
    const dateKey = req.query.dateKey || getDateKey();
    const data = await getCrmStatsReport({ lookbackDays, dateKey });
    res.json({ success: true, data });
  } catch (error) {
    logger.error('CrmStats', 'Report fetch failed', { error: error.message });
    res.status(500).json({ success: false, message: error.message || 'Failed to load CRM stats' });
  }
});

module.exports = router;
