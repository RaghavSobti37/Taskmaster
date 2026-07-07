const Tenant = require('../models/Tenant');
const { canManageOrganizationSettings } = require('../../shared/orgPermissions.cjs');
const {
  listActiveMemberships,
  formatMembershipRow,
  getMembership,
  selectTenant,
} = require('./tenantMembershipService');
const { getTenantUnlockState } = require('./tenantUnlockService');
const {
  buildOnboardingChecklistPayload,
} = require('./onboardingChecklistService');
const { handleProfileUpdated } = require('./onboardingListener');

const BYPASS = { bypassTenant: true };

const formatTenantContext = (tenant) => ({
  _id: tenant._id,
  name: tenant.name,
  slug: tenant.slug,
  plan: tenant.plan,
  industry: tenant.industry,
  teamSize: tenant.teamSize,
  settings: tenant.settings,
  branding: tenant.branding,
  clerkOrganizationId: tenant.clerkOrganizationId || null,
  featureUnlocks: tenant.featureUnlocks,
});

const formatMembershipContext = (membership) => ({
  id: String(membership._id),
  role: membership.role,
  status: membership.status,
  needsRoleReview: Boolean(membership.needsRoleReview),
});

const resolveTenantBySlug = async (slug) => {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized) return null;
  return Tenant.findOne({ slug: normalized }).setOptions(BYPASS);
};

const buildOrgContext = async ({
  user,
  tenant,
  membership,
  includeAllMemberships = false,
}) => {
  const tenantId = tenant._id;
  await handleProfileUpdated({ user, tenantId });
  const unlockState = await getTenantUnlockState(tenantId);
  const onboarding = buildOnboardingChecklistPayload(tenant.onboardingProgress, tenant);

  const permissions = {
    canEditSettings: canManageOrganizationSettings({ user, membership, tenant }),
    canManageFeatures: canManageOrganizationSettings({ user, membership, tenant }),
  };

  const payload = {
    tenant: formatTenantContext(tenant),
    membership: formatMembershipContext(membership),
    permissions,
    featureUnlocks: unlockState.unlocks,
    locks: unlockState.locks,
    plan: unlockState.plan,
    limits: unlockState.limits,
    onboarding,
    activeTenantId: String(tenantId),
    activeTenantSlug: tenant.slug || null,
  };

  if (includeAllMemberships) {
    const rows = await listActiveMemberships(user._id);
    payload.memberships = rows.map(formatMembershipRow);
  }

  return payload;
};

const getOrgContextBySlug = async ({
  user,
  slug,
  req,
  res,
  includeAllMemberships = false,
  syncSession = true,
}) => {
  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) {
    const err = new Error('Organization not found');
    err.status = 404;
    throw err;
  }

  const membership = await getMembership(user._id, tenant._id);
  if (!membership) {
    const err = new Error('Not a member of this organization');
    err.status = 403;
    throw err;
  }

  if (syncSession && req && res && String(req.tenantId) !== String(tenant._id)) {
    await selectTenant(req, res, user._id, tenant._id);
  }

  return buildOrgContext({
    user,
    tenant,
    membership,
    includeAllMemberships,
  });
};

const resolveActiveTenantSlug = async (activeTenantId) => {
  if (!activeTenantId) return null;
  const tenant = await Tenant.findById(activeTenantId).setOptions(BYPASS).select('slug');
  return tenant?.slug || null;
};

module.exports = {
  formatTenantContext,
  getOrgContextBySlug,
  resolveActiveTenantSlug,
  resolveTenantBySlug,
  buildOrgContext,
};
