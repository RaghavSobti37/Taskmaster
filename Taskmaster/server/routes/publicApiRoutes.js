const express = require('express');
const { apiKeyAuth } = require('../middleware/apiKeyAuth');
const asyncHandler = require('../middleware/asyncHandler');
const { incrementUsage } = require('../services/planEnforcementService');
const Lead = require('../models/Lead');
const { createLead } = require('../domains/crm/services/leadWriteService');
const User = require('../models/User');

const router = express.Router();

router.use(apiKeyAuth);

function requireScope(...accepted) {
  return (req, res, next) => {
    const scopes = new Set(req.apiKeyScopes || []);
    if (scopes.has('*') || accepted.some((scope) => scopes.has(scope))) return next();
    return res.status(403).json({ error: 'API key scope denied', code: 'API_KEY_SCOPE_DENIED' });
  };
}

router.get(
  '/health',
  requireScope('read', 'health:read'),
  asyncHandler(async (req, res) => {
    await incrementUsage(req.tenantId, 'apiCalls');
    res.json({ ok: true, tenantId: String(req.tenantId) });
  }),
);

router.post(
  '/leads',
  requireScope('write', 'leads:write'),
  asyncHandler(async (req, res) => {
    await incrementUsage(req.tenantId, 'apiCalls');
    const systemUser = await User.findOne({ tenantId: req.tenantId })
      .setOptions({ bypassTenant: true })
      .sort({ createdAt: 1 });
    if (!systemUser) return res.status(500).json({ error: 'No tenant user available' });

    const result = await createLead(systemUser, {
      ...req.body,
      source: req.body?.source || 'Public API',
      crmType: 'standard',
    });
    if (result.error) {
      return res.status(result.status || 400).json({ error: result.error });
    }
    res.status(201).json({ lead: result.lead });
  }),
);

router.get(
  '/leads/:id',
  requireScope('read', 'leads:read'),
  asyncHandler(async (req, res) => {
    await incrementUsage(req.tenantId, 'apiCalls');
    const lead = await Lead.findOne({ _id: req.params.id, tenantId: req.tenantId })
      .setOptions({ bypassTenant: true })
      .lean();
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json({ lead });
  }),
);

module.exports = router;
