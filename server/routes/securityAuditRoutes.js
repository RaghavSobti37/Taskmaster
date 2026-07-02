const express = require('express');
const { protect, requirePageAccess } = require('../middleware/authMiddleware');
const { listSecurityAudits } = require('../services/securityAuditService');
const logger = require('../utils/logger');

const router = express.Router();
const adminAccess = requirePageAccess('admin_data');

router.use(protect, adminAccess);

router.get('/', async (req, res) => {
  try {
    const payload = await listSecurityAudits(req.query);
    res.json(payload);
  } catch (error) {
    logger.error('securityAuditRoutes', 'GET /', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
