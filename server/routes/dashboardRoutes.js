const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

router.get('/summary', protect, dashboardController.getDashboardSummary);
router.get('/dept-stats', protect, dashboardController.getDepartmentStats);

module.exports = router;
