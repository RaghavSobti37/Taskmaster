const {
  canManageOrganizationSettings,
  canDeleteOrganization,
} = require('../../shared/orgPermissions.cjs');

describe('orgPermissions', () => {
  const ownerId = '507f1f77bcf86cd799439011';
  const otherId = '507f1f77bcf86cd799439012';

  it('allows owner and admin membership roles', () => {
    expect(canManageOrganizationSettings({ membership: { role: 'owner' } })).toBe(true);
    expect(canManageOrganizationSettings({ membership: { role: 'admin' } })).toBe(true);
    expect(canManageOrganizationSettings({ membership: { role: 'member' } })).toBe(false);
  });

  it('allows tenant ownerId match even when membership is member', () => {
    expect(canManageOrganizationSettings({
      user: { _id: ownerId },
      membership: { role: 'member' },
      tenant: { ownerId },
    })).toBe(true);
  });

  it('allows department admin users', () => {
    expect(canManageOrganizationSettings({
      user: {
        _id: otherId,
        departmentId: { slug: 'admin', permissionPreset: 'admin' },
      },
      membership: { role: 'member' },
      tenant: { ownerId },
    })).toBe(true);
  });

  it('canDeleteOrganization is owner-only', () => {
    expect(canDeleteOrganization({
      user: { _id: ownerId },
      membership: { role: 'owner' },
      tenant: { ownerId: otherId },
    })).toBe(true);
    expect(canDeleteOrganization({
      user: { _id: ownerId },
      membership: { role: 'admin' },
      tenant: { ownerId },
    })).toBe(true);
    expect(canDeleteOrganization({
      user: { _id: otherId },
      membership: { role: 'admin' },
      tenant: { ownerId },
    })).toBe(false);
  });
});
