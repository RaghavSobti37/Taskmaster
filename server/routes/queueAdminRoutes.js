const express = require('express');
const { protect, requirePageAccess } = require('../middleware/authMiddleware');

const scriptsAccess = requirePageAccess('admin_scripts');
const { getQueueAdminSnapshot, cleanFailedJobs } = require('../services/queueAdminService');

const router = express.Router();

router.get('/status', protect, scriptsAccess, async (_req, res) => {
  try {
    const snapshot = await getQueueAdminSnapshot();
    res.json(snapshot);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to load queue status' });
  }
});

router.post('/clean-failed', protect, scriptsAccess, async (_req, res) => {
  try {
    const result = await cleanFailedJobs();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to clean queue failures' });
  }
});

module.exports = router;
