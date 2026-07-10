const express = require('express');
const router = express.Router();
const { protect, requirePageAccess } = require('../middleware/authMiddleware');
const platformSettingsService = require('../services/platformSettingsService');
const logger = require('../utils/logger');
const { auditSensitiveMutation } = require('../services/securityAuditService');

const adminAccess = requirePageAccess('admin_users');

router.get('/exclusions', protect, async (req, res) => {
  try {
    res.json(await platformSettingsService.getExclusionsForClient());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.use(protect, adminAccess);

router.get('/', async (req, res) => {
  try {
    res.json(await platformSettingsService.getAdminSettings());
  } catch (err) {
    logger.error('platformSettings', 'GET error', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

router.put('/', auditSensitiveMutation({ resourceType: 'PlatformSettings', action: 'UPDATE' }), async (req, res) => {
  try {
    const payload = await platformSettingsService.updateAdminSettings(req.body, req.user._id);
    res.json(payload);
  } catch (err) {
    logger.error('platformSettings', 'PUT error', { error: err.message });
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
