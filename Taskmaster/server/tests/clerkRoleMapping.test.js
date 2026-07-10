const {
  CLERK_ORG_ADMIN_ROLE,
  CLERK_ORG_MEMBER_ROLE,
  mapTenantMembershipRoleToClerkRole,
  mapClerkRoleToMembership,
} = require('../utils/clerkRoleMapping');

describe('clerkRoleMapping', () => {
  describe('mapTenantMembershipRoleToClerkRole', () => {
    it('maps owner to org:admin', () => {
      expect(mapTenantMembershipRoleToClerkRole('owner')).toBe(CLERK_ORG_ADMIN_ROLE);
    });

    it('maps admin to org:admin', () => {
      expect(mapTenantMembershipRoleToClerkRole('admin')).toBe(CLERK_ORG_ADMIN_ROLE);
    });

    it('maps member to org:member', () => {
      expect(mapTenantMembershipRoleToClerkRole('member')).toBe(CLERK_ORG_MEMBER_ROLE);
    });

    it('defaults unknown roles to org:member', () => {
      expect(mapTenantMembershipRoleToClerkRole('guest')).toBe(CLERK_ORG_MEMBER_ROLE);
      expect(mapTenantMembershipRoleToClerkRole('')).toBe(CLERK_ORG_MEMBER_ROLE);
    });
  });

  describe('mapClerkRoleToMembership', () => {
    it('maps org:admin to admin', () => {
      expect(mapClerkRoleToMembership('org:admin')).toEqual({
        role: 'admin',
        needsRoleReview: false,
      });
    });

    it('maps org:member to member', () => {
      expect(mapClerkRoleToMembership('org:member')).toEqual({
        role: 'member',
        needsRoleReview: false,
      });
    });

    it('flags unknown Clerk roles for review', () => {
      expect(mapClerkRoleToMembership('org:custom')).toEqual({
        role: 'member',
        needsRoleReview: true,
      });
    });
  });
});
