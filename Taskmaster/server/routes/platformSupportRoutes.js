const express = require('express');
const { protect, requirePlatformAdmin } = require('../middleware/authMiddleware');
const asyncHandler = require('../middleware/asyncHandler');
const { recordAuditEvent } = require('../services/auditEventService');
const { reissueSessionWithTenant } = require('../services/tenantMembershipService');

const router = express.Router();
const IMPERSONATION_TTL_MS = 60 * 60 * 1000;

router.post(
  '/impersonate',
  protect,
  requirePlatformAdmin,
  asyncHandler(async (req, res) => {
    const { tenantId, reason } = req.body || {};
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
    if (!reason || String(reason).trim().length < 8) {
      return res.status(400).json({ error: 'reason required (min 8 chars)' });
    }
    await reissueSessionWithTenant(req, res, req.user._id, tenantId);
    await recordAuditEvent({
      tenantId,
      actorId: req.user._id,
      actorEmail: req.user.email,
      action: 'support.impersonation.started',
      resourceType: 'tenant',
      resourceId: tenantId,
      impersonationReason: String(reason).trim(),
      metadata: { expiresAt: new Date(Date.now() + IMPERSONATION_TTL_MS).toISOString() },
      req,
    });
    res.json({
      success: true,
      activeTenantId: String(tenantId),
      expiresAt: new Date(Date.now() + IMPERSONATION_TTL_MS).toISOString(),
    });
  }),
);

module.exports = router;
