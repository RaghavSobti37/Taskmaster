/** Clerk organization roles (push + pull sync). */
const CLERK_ORG_ADMIN_ROLE = 'org:admin';
const CLERK_ORG_MEMBER_ROLE = 'org:member';

/**
 * Mongo TenantMembership.role → Clerk organization membership role.
 * owner/admin → org:admin; member → org:member.
 */
const mapTenantMembershipRoleToClerkRole = (membershipRole) => {
  const role = String(membershipRole || '').trim().toLowerCase();
  if (role === 'owner' || role === 'admin') return CLERK_ORG_ADMIN_ROLE;
  return CLERK_ORG_MEMBER_ROLE;
};

/**
 * Clerk organization membership role → Mongo TenantMembership fields.
 */
const mapClerkRoleToMembership = (clerkRole) => {
  const role = String(clerkRole || '').trim().toLowerCase();
  if (role === CLERK_ORG_ADMIN_ROLE || role === 'admin') {
    return { role: 'admin', needsRoleReview: false };
  }
  if (role === CLERK_ORG_MEMBER_ROLE || role === 'member') {
    return { role: 'member', needsRoleReview: false };
  }
  return { role: 'member', needsRoleReview: true };
};

module.exports = {
  CLERK_ORG_ADMIN_ROLE,
  CLERK_ORG_MEMBER_ROLE,
  mapTenantMembershipRoleToClerkRole,
  mapClerkRoleToMembership,
};
