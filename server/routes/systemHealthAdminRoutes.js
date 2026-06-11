const express = require('express');
const { protect, admin } = require('../middleware/authMiddleware');
const { getAdminSystemHealth } = require('../services/systemHealthProbeService');

const router = express.Router();

// Dept-admin only — matches SystemHealthCard (isAdminUser) and componentRegistry access: ['admin'].
// Dashboard widget has no page-permission gate; keep admin middleware, not requirePageAccess.
router.use(protect, admin);

router.get('/', async (_req, res) => {
  try {
    const report = await getAdminSystemHealth();
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to load system health',
    });
  }
});

module.exports = router;
