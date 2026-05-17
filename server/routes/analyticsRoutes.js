const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { protect } = require('../middleware/authMiddleware');

router.get('/cumulative', protect, analyticsController.getCumulativeMetrics);

module.exports = router;
