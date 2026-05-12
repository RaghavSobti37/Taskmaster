const express = require('express');
const router = express.Router();
const Log = require('../models/Log');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, async (req, res) => {
  try {
    const logs = await Log.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('userId', 'name avatar');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const { action, targetType, details } = req.body;
    const log = await Log.create({
      userId: req.user._id,
      action,
      targetType,
      details
    });
    const populatedLog = await Log.findById(log._id).populate('userId', 'name avatar');
    res.status(201).json(populatedLog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
