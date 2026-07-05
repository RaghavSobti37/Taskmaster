const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { isAdminUser } = require('../utils/departmentPermissions');
const asyncHandler = require('../middleware/asyncHandler');
const {
  listActiveMemberships,
  formatMembershipRow,
  createTenantForUser,
  selectTenant,
  createInvite,
  getTenantUnlocks,
  getMembership,
} = require('../services/tenantMembershipService');
const Tenant = require('../models/Tenant');
const { getTokenFromRequest } = require('../utils/authCookie');
const { verifySessionToken } = require('../utils/authSession');

const router = express.Router();

const activeTenantFromRequest = (req) => {
  const token = getTokenFromRequest(req);
  if (!token) return req.tenantId || null;
  try {
    const decoded = verifySessionToken(token);
    return decoded.activeTenantId || req.tenantId || null;
  } catch {
    return req.tenantId || null;
  }
};

router.get(
  '/memberships',
  protect,
  asyncHandler(async (req, res) => {
    const rows = await listActiveMemberships(req.user._id);
    res.json({
      memberships: rows.map(formatMembershipRow),
      activeTenantId: activeTenantFromRequest(req),
      needsTenantSelection: rows.length > 1 && !activeTenantFromRequest(req),
    });
  }),
);

router.post(
  '/select',
  protect,
  asyncHandler(async (req, res) => {
    const { tenantId } = req.body || {};
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
    await selectTenant(req, res, req.user._id, tenantId);
    res.json({ success: true, activeTenantId: String(tenantId) });
  }),
);

router.post(
  '/create',
  protect,
  asyncHandler(async (req, res) => {
    const { name } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Organization name required' });
    const tenant = await createTenantForUser(req.user._id, {
      name: String(name).trim(),
      contactEmail: req.user.email,
    });
    await selectTenant(req, res, req.user._id, tenant._id);
    res.status(201).json({ tenant: { _id: tenant._id, name: tenant.name, slug: tenant.slug } });
  }),
);

router.get(
  '/:id/unlocks',
  protect,
  asyncHandler(async (req, res) => {
    const tenantId = req.params.id;
    if (String(req.tenantId) !== String(tenantId)) {
      return res.status(403).json({ error: 'Not authorized for this organization' });
    }
    const unlocks = await getTenantUnlocks(tenantId);
    res.json({ unlocks });
  }),
);

router.patch(
  '/:id/onboarding',
  protect,
  asyncHandler(async (req, res) => {
    const tenantId = req.params.id;
    if (String(req.tenantId) !== String(tenantId)) {
      return res.status(403).json({ error: 'Not authorized for this organization' });
    }
    const tenant = await Tenant.findById(tenantId).setOptions({ bypassTenant: true });
    if (!tenant) return res.status(404).json({ error: 'Organization not found' });

    const { completedStep, dismissedChecklist } = req.body || {};
    if (!tenant.onboardingProgress) tenant.onboardingProgress = { completedSteps: [], dismissedChecklist: false };
    if (completedStep && !tenant.onboardingProgress.completedSteps.includes(completedStep)) {
      tenant.onboardingProgress.completedSteps.push(completedStep);
    }
    if (dismissedChecklist === true) tenant.onboardingProgress.dismissedChecklist = true;
    tenant.updatedAt = new Date();
    await tenant.save();
    res.json({ onboardingProgress: tenant.onboardingProgress });
  }),
);

router.post(
  '/:id/invites',
  protect,
  asyncHandler(async (req, res) => {
    const tenantId = req.params.id;
    if (String(req.tenantId) !== String(tenantId)) {
      return res.status(403).json({ error: 'Not authorized for this organization' });
    }
    const membership = await getMembership(req.user._id, tenantId);
    const canInvite = membership && ['owner', 'admin'].includes(membership.role);
    if (!canInvite && !isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Organization admin required to send invites' });
    }
    const { email, role } = req.body || {};
    const { invite, token } = await createInvite({
      tenantId,
      email,
      role,
      invitedBy: req.user._id,
    });
    res.status(201).json({
      inviteId: invite._id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      acceptPath: `/invites/${token}/accept`,
    });
  }),
);

module.exports = router;
