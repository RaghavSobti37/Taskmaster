const express = require('express');
const router = express.Router();
const dashboardController = require('./controllers/dashboardController');
const { protect } = require('../../middleware/authMiddleware');

router.get('/summary', protect, dashboardController.getDashboardSummary);
router.get('/dept-stats', protect, dashboardController.getDepartmentStats);
router.get('/attendance-overview', protect, dashboardController.getAttendanceOverview);
router.get('/task-activity', protect, dashboardController.getTaskActivitySeries);

module.exports = router;
