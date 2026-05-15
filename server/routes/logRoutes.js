const express = require('express');
const router = express.Router();
const Log = require('../models/Log');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, async (req, res) => {
  try {
    const { userId, action, lastId, limit = 50, startDate, endDate } = req.query;
    const filter = {};
    if (userId && userId !== 'undefined' && userId !== 'null') {
      filter.userId = userId;
    }
    if (action) filter.action = action;
    
    if (lastId) {
      filter._id = { $lt: lastId };
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    const logs = await Log.find(filter)
      .sort({ _id: -1 }) // Sort by ID for stable cursor pagination
      .limit(parseInt(limit))
      .populate({ path: 'userId', select: 'name avatar role' })
      .lean();
      
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

router.delete('/clear', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'ADMIN CLEARANCE REQUIRED' });
    }
    await Log.deleteMany({});
    res.json({ message: 'SYSTEM SIGNALS CLEARED' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
