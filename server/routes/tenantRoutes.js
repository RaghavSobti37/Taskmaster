const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { canManageOrganizationSettings } = require('../../shared/orgPermissions.cjs');
const asyncHandler = require('../middleware/asyncHandler');
const {
  listActiveMemberships,
  formatMembershipRow,
  createTenantForUser,
  selectTenant,
  createInvite,
  getMembership,
} = require('../services/tenantMembershipService');
const { getTenantUnlocks } = require('../services/tenantUnlockService');
const Tenant = require('../models/Tenant');
const {
  buildOnboardingChecklistPayload,
  defaultOnboardingProgress,
  snoozeChecklist,
  isChecklistComplete,
} = require('../services/onboardingChecklistService');
const { getApplicableOnboardingSteps } = require('../../shared/orgOnboardingChecklist.cjs');
const { emitOnboardingEvent } = require('../services/onboardingEvents');
const { handleProfileUpdated } = require('../services/onboardingListener');
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

const formatTenantSettings = (tenant) => ({
  _id: tenant._id,
  name: tenant.name,
  slug: tenant.slug,
  industry: tenant.industry,
  teamSize: tenant.teamSize,
  settings: tenant.settings,
  branding: tenant.branding,
  clerkOrganizationId: tenant.clerkOrganizationId || null,
});

const assertActiveTenantAccess = (req, tenantId) => {
  if (String(req.tenantId) !== String(tenantId)) {
    const err = new Error('Not authorized for this organization');
    err.status = 403;
    throw err;
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
    const {
      name,
      slug,
      logo,
      industry,
      teamSize,
      settings,
      invites,
    } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Organization name required' });

    const tenant = await createTenantForUser(req.user._id, {
      name: String(name).trim(),
      slug,
      logo,
      industry,
      teamSize,
      settings,
      invites,
      contactEmail: req.user.email,
    });
    await selectTenant(req, res, req.user._id, tenant._id);
    res.status(201).json({
      tenant: {
        _id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        clerkOrganizationId: tenant.clerkOrganizationId || null,
        industry: tenant.industry,
        teamSize: tenant.teamSize,
        settings: tenant.settings,
        branding: tenant.branding,
        onboardingProgress: tenant.onboardingProgress,
      },
    });
  }),
);

router.get(
  '/:id/settings',
  protect,
  asyncHandler(async (req, res) => {
    const tenantId = req.params.id;
    assertActiveTenantAccess(req, tenantId);
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return res.status(404).json({ error: 'Organization not found' });
    const membership = await getMembership(req.user._id, tenantId);
    res.json({
      tenant: formatTenantSettings(tenant),
      permissions: {
        canEditSettings: canManageOrganizationSettings({
          user: req.user,
          membership,
          tenant,
        }),
      },
    });
  }),
);

router.patch(
  '/:id/settings',
  protect,
  asyncHandler(async (req, res) => {
    const tenantId = req.params.id;
    assertActiveTenantAccess(req, tenantId);

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return res.status(404).json({ error: 'Organization not found' });

    const membership = await getMembership(req.user._id, tenantId);
    if (!canManageOrganizationSettings({ user: req.user, membership, tenant })) {
      return res.status(403).json({ error: 'Organization admin required to update settings' });
    }

    const { name, logo, industry, teamSize, settings } = req.body || {};

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) return res.status(400).json({ error: 'Organization name required' });
      tenant.name = trimmed;
    }
    if (industry !== undefined) tenant.industry = industry ? String(industry).trim() : undefined;
    if (teamSize !== undefined) tenant.teamSize = teamSize ? String(teamSize).trim() : undefined;

    if (logo !== undefined) {
      if (!tenant.branding) tenant.branding = {};
      tenant.branding.logoUrl = logo ? String(logo).trim() : undefined;
    }

    if (settings && typeof settings === 'object') {
      if (!tenant.settings) tenant.settings = {};
      if (settings.timezone !== undefined) {
        tenant.settings.timezone = String(settings.timezone).trim() || 'Asia/Kolkata';
      }
      if (settings.defaultCurrency !== undefined) {
        tenant.settings.defaultCurrency = String(settings.defaultCurrency).trim() || 'INR';
      }
      if (settings.dateFormat !== undefined) {
        tenant.settings.dateFormat = String(settings.dateFormat).trim() || 'DD/MM/YYYY';
      }
    }

    tenant.updatedAt = new Date();
    await tenant.save();
    res.json({
      tenant: formatTenantSettings(tenant),
      permissions: {
        canEditSettings: canManageOrganizationSettings({
          user: req.user,
          membership,
          tenant,
        }),
      },
    });
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
    await handleProfileUpdated({ user: req.user, tenantId });
    const tenant = await Tenant.findById(tenantId);
    const unlocks = await getTenantUnlocks(tenantId);
    const checklist = buildOnboardingChecklistPayload(tenant?.onboardingProgress, tenant);
    res.json({ unlocks, ...checklist });
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
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return res.status(404).json({ error: 'Organization not found' });

    const { completedStep, dismissedChecklist, dismissChecklist } = req.body || {};
    if (!tenant.onboardingProgress) tenant.onboardingProgress = defaultOnboardingProgress();
    if (completedStep && !tenant.onboardingProgress.completedSteps.includes(completedStep)) {
      tenant.onboardingProgress.completedSteps.push(completedStep);
    }
    if (dismissChecklist === true || dismissedChecklist === true) {
      tenant.onboardingProgress = snoozeChecklist(tenant.onboardingProgress);
    }
    if (isChecklistComplete(tenant.onboardingProgress, getApplicableOnboardingSteps(tenant))) {
      tenant.onboardingProgress.dismissedChecklist = true;
    }
    tenant.updatedAt = new Date();
    await tenant.save();
    res.json(buildOnboardingChecklistPayload(tenant.onboardingProgress, tenant));
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
    const result = await createInvite({
      tenantId,
      email,
      role,
      invitedBy: req.user._id,
    });

    if (result.source === 'clerk') {
      emitOnboardingEvent('invite.sent', { tenantId });
      return res.status(201).json({
        clerkInvitationId: result.clerkInvitationId,
        email: result.email,
        role: result.role,
        expiresAt: result.expiresAt,
        source: 'clerk',
      });
    }

    const { invite, token } = result;
    emitOnboardingEvent('invite.sent', { tenantId });
    res.status(201).json({
      inviteId: invite._id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      acceptPath: `/invites/${token}/accept`,
      source: 'mongo',
    });
  }),
);

module.exports = router;
