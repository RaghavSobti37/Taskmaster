const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const { protect } = require('../middleware/authMiddleware');
const logActivity = require('../utils/activityLogger');

// Get all messages for current outlet
router.get('/', protect, async (req, res) => {
  try {
    const { channel, limit = 50, skip = 0 } = req.query;
    const query = { outletId: req.user?.outletId || 'main' };
    if (channel) query.channel = channel;

    const messages = await Message.find(query)
      .populate('senderId', 'name avatar')
      .populate('mentions', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Post a message
router.post('/', protect, async (req, res) => {
  try {
    const { content, mentions, taskId, channel } = req.body;
    const message = await Message.create({
      senderId: req.user._id,
      content,
      mentions,
      taskId,
      channel: channel || 'General Hub',
      outletId: req.user?.outletId || 'main'
    });
    const populated = await Message.findById(message._id).populate('senderId', 'name avatar').populate('mentions', 'name');
    
    // Log to system activity
    logActivity(req.user._id, 'CHAT_MESSAGE', message._id, 'Chat', { 
      message: content,
      channel: channel || 'General Hub'
    });

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
