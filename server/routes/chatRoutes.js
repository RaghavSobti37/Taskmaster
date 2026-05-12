const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const { protect } = require('../middleware/authMiddleware');

// Get all messages for current outlet
router.get('/', protect, async (req, res) => {
  try {
    const messages = await Message.find({ outletId: req.user?.outletId || 'main' })
      .populate('senderId', 'name avatar')
      .populate('mentions', 'name')
      .sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Post a message
router.post('/', protect, async (req, res) => {
  try {
    const { content, mentions, taskId } = req.body;
    const message = await Message.create({
      senderId: req.user._id,
      content,
      mentions,
      taskId,
      outletId: req.user?.outletId || 'main'
    });
    const populated = await Message.findById(message._id).populate('senderId', 'name avatar').populate('mentions', 'name');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
