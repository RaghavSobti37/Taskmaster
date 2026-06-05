const express = require('express');
const { protect, opsOrAdmin } = require('../middleware/authMiddleware');
const { getQueueAdminSnapshot } = require('../services/queueAdminService');

const router = express.Router();

router.get('/status', protect, opsOrAdmin, async (_req, res) => {
  try {
    const snapshot = await getQueueAdminSnapshot();
    res.json(snapshot);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to load queue status' });
  }
});

module.exports = router;
