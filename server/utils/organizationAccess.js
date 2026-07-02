const Tenant = require('../models/Tenant');

const emailDomain = (email) => {
  const normalized = String(email || '').trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  return at >= 0 ? normalized.slice(at + 1) : '';
};

const matchesAllowedDomain = (email, allowedDomain) => {
  const domain = String(allowedDomain || '').trim().toLowerCase();
  if (!domain) return true;
  return emailDomain(email) === domain;
};

const pinnedClerkOrganizationId = () =>
  String(process.env.CLERK_ORGANIZATION_ID || '').trim() || null;

/** Opt-in org gate — pinned CLERK_ORGANIZATION_ID alone does not block users-only login. */
const shouldEnforceClerkOrganization = () =>
  String(process.env.CLERK_REQUIRE_ORGANIZATION || '').trim().toLowerCase() === 'true';

const resolveClerkOrganizationId = ({ bodyOrganizationId, tokenOrganizationId } = {}) => {
  const pinned = pinnedClerkOrganizationId();
  if (pinned) return pinned;
  const fromBody = String(bodyOrganizationId || '').trim();
  if (fromBody) return fromBody;
  const fromToken = String(tokenOrganizationId || '').trim();
  return fromToken || null;
};

const resolveTenantForOrganization = async (clerkOrganizationId) => {
  if (!clerkOrganizationId) return null;
  const tenant = await Tenant.findOne({ clerkOrganizationId })
    .setOptions({ bypassTenant: true })
    .lean();
  if (tenant) return tenant;

  const slug = String(process.env.PLATFORM_TENANT_SLUG || '').trim();
  if (slug) {
    const bySlug = await Tenant.findOne({ slug })
      .setOptions({ bypassTenant: true })
      .lean();
    if (bySlug) return bySlug;
  }

  const allowedDomain = String(process.env.ALLOWED_DOMAIN || '').trim().toLowerCase();
  if (allowedDomain) {
    const byDomain = await Tenant.findOne({ allowedEmailDomain: allowedDomain })
      .setOptions({ bypassTenant: true })
      .lean();
    if (byDomain) return byDomain;
  }

  return null;
};

const tenantAllowedDomain = (tenant) => {
  const fromTenant = String(tenant?.allowedEmailDomain || '').trim().toLowerCase();
  if (fromTenant) return fromTenant;
  return String(process.env.ALLOWED_DOMAIN || '').trim().toLowerCase();
};

const isOrgMember = async (clerkClient, clerkUserId, clerkOrganizationId) => {
  if (!clerkUserId || !clerkOrganizationId) return false;
  try {
    const list = await clerkClient.users.getOrganizationMembershipList({
      userId: clerkUserId,
      limit: 100,
    });
    const memberships = list?.data || [];
    return memberships.some(
      (entry) => entry?.organization?.id === clerkOrganizationId
        || entry?.organizationId === clerkOrganizationId,
    );
  } catch {
    return false;
  }
};

const addOrgMember = async (clerkClient, clerkUserId, clerkOrganizationId, role = 'org:member') => {
  await clerkClient.organizations.createOrganizationMembership({
    organizationId: clerkOrganizationId,
    userId: clerkUserId,
    role,
  });
};

/**
 * Ensure Clerk user may access the deployment organization.
 * Members (incl. accepted invites) pass. Matching verified domain auto-joins org.
 */
const ensureClerkOrganizationAccess = async ({
  clerkClient,
  clerkUserId,
  email,
  clerkOrganizationId,
  tenant,
  adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
}) => {
  if (!clerkOrganizationId) {
    return { joined: false, reason: 'none' };
  }

  const emailLower = String(email || '').trim().toLowerCase();
  const allowedDomain = tenantAllowedDomain(tenant);

  if (await isOrgMember(clerkClient, clerkUserId, clerkOrganizationId)) {
    return { joined: false, reason: 'member' };
  }

  if (emailLower === adminEmail) {
    await addOrgMember(clerkClient, clerkUserId, clerkOrganizationId);
    return { joined: true, reason: 'admin_bootstrap' };
  }

  if (allowedDomain && matchesAllowedDomain(emailLower, allowedDomain)) {
    await addOrgMember(clerkClient, clerkUserId, clerkOrganizationId);
    return { joined: true, reason: 'verified_domain' };
  }

  const err = new Error(
    allowedDomain
      ? `Access restricted to @${allowedDomain} or invited members of this organization.`
      : 'You are not a member of this organization. Ask an admin for an invitation.',
  );
  err.status = 403;
  throw err;
};

module.exports = {
  emailDomain,
  matchesAllowedDomain,
  pinnedClerkOrganizationId,
  shouldEnforceClerkOrganization,
  resolveClerkOrganizationId,
  resolveTenantForOrganization,
  tenantAllowedDomain,
  isOrgMember,
  ensureClerkOrganizationAccess,
};
