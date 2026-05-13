const express = require('express');
const router = express.Router();
const Log = require('../models/Log');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, async (req, res) => {
  try {
    const { userId, action, page = 1, limit = 50, startDate, endDate } = req.query;
    const filter = {};
    if (userId && userId !== 'undefined' && userId !== 'null') {
      filter.userId = userId;
    }
    if (action) filter.action = action;
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    const logs = await Log.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('userId', 'name avatar');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const { action, targetType, targetId, details } = req.body;
    const log = await Log.create({
      userId: req.user._id,
      action,
      targetType,
      targetId,
      details
    });
    const populatedLog = await Log.findById(log._id).populate('userId', 'name avatar');
    res.status(201).json(populatedLog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
