import { describe, expect, it } from 'vitest';
import {
  canManageOrganizationSettings,
  canDeleteOrganization,
} from '@shared/orgPermissions';

describe('orgPermissions (client)', () => {
  it('allows department admin with member membership', () => {
    expect(canManageOrganizationSettings({
      user: {
        _id: 'u1',
        departmentId: { slug: 'admin', permissionPreset: 'admin' },
      },
      membership: { role: 'member' },
      tenant: { ownerId: 'other' },
    })).toBe(true);
  });

  it('denies plain member without owner or dept admin', () => {
    expect(canManageOrganizationSettings({
      user: { _id: 'u1', departmentId: { slug: 'ops' } },
      membership: { role: 'member' },
      tenant: { ownerId: 'other' },
    })).toBe(false);
  });

  it('canDeleteOrganization requires owner role or ownerId', () => {
    expect(canDeleteOrganization({
      user: { _id: 'u1' },
      membership: { role: 'admin' },
      tenant: { ownerId: 'other' },
    })).toBe(false);
    expect(canDeleteOrganization({
      user: { _id: 'u1' },
      membership: { role: 'owner' },
    })).toBe(true);
  });
});
