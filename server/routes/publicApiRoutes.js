const express = require('express');
const { apiKeyAuth } = require('../middleware/apiKeyAuth');
const asyncHandler = require('../middleware/asyncHandler');
const { incrementUsage } = require('../services/planEnforcementService');

const router = express.Router();

router.use(apiKeyAuth);

router.get(
  '/health',
  asyncHandler(async (req, res) => {
    await incrementUsage(req.tenantId, 'apiCalls');
    res.json({ ok: true, tenantId: String(req.tenantId) });
  }),
);

module.exports = router;
