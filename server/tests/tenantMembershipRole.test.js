const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const TenantMembership = require('../models/TenantMembership');
const TenantInvite = require('../models/TenantInvite');
const User = require('../models/User');
const {
  formatMembershipRow,
  resolveMembershipRoleFromExternal,
  acceptInvite,
  createInvite,
  hashToken,
} = require('../services/tenantMembershipService');

describe('tenant membership role handling', () => {
  it('requires non-null membership role with member default', async () => {
    const tenantId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();

    const membership = await TenantMembership.create({
      tenantId,
      userId,
      status: 'active',
    });
    expect(membership.role).toBe('member');
    expect(membership.needsRoleReview).toBe(false);
    await TenantMembership.deleteOne({ _id: membership._id });
  });

  it('formatMembershipRow includes needsRoleReview', () => {
    const row = formatMembershipRow({
      _id: new mongoose.Types.ObjectId(),
      role: 'member',
      needsRoleReview: true,
      status: 'active',
      tenantId: { _id: new mongoose.Types.ObjectId(), name: 'Acme', slug: 'acme', plan: 'free' },
    });
    expect(row.needsRoleReview).toBe(true);
    expect(row.role).toBe('member');
  });

  describe('resolveMembershipRoleFromExternal', () => {
    it('maps standard and known roles', () => {
      expect(resolveMembershipRoleFromExternal('standard')).toEqual({
        role: 'member',
        needsRoleReview: false,
      });
      expect(resolveMembershipRoleFromExternal('admin')).toEqual({
        role: 'admin',
        needsRoleReview: false,
      });
    });

    it('falls back to member with needsRoleReview for unmapped roles', () => {
      expect(resolveMembershipRoleFromExternal('billing_manager')).toEqual({
        role: 'member',
        needsRoleReview: true,
      });
      expect(resolveMembershipRoleFromExternal('owner')).toEqual({
        role: 'member',
        needsRoleReview: true,
      });
    });
  });

  it('acceptInvite always applies invite role even when membership already exists', async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tenant = await Tenant.create({
      name: `Role Tenant ${stamp}`,
      slug: `role-tenant-${stamp}`,
      contactEmail: `owner-${stamp}@coreknot-test.local`,
    });

    const owner = await User.create({
      name: 'Owner',
      email: `owner-${stamp}@coreknot-test.local`,
      password: 'test-password-123',
      tenantId: tenant._id,
    });

    const invitee = await User.create({
      name: 'Invitee',
      email: `invitee-${stamp}@coreknot-test.local`,
      password: 'test-password-123',
    });

    await TenantMembership.create({
      tenantId: tenant._id,
      userId: invitee._id,
      role: 'member',
      needsRoleReview: true,
      status: 'active',
    });

    const rawToken = 'a'.repeat(64);
    await TenantInvite.create({
      tenantId: tenant._id,
      email: invitee.email,
      role: 'admin',
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + 86400000),
      status: 'pending',
      invitedBy: owner._id,
    });

    await acceptInvite(rawToken, invitee._id);

    const membership = await TenantMembership.findOne({
      tenantId: tenant._id,
      userId: invitee._id,
    }).setOptions({ bypassTenant: true });
    expect(membership.role).toBe('admin');
    expect(membership.needsRoleReview).toBe(false);
  });

  it('createInvite requires explicit admin or member role', async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tenant = await Tenant.create({
      name: `Invite Tenant ${stamp}`,
      slug: `invite-tenant-${stamp}`,
      contactEmail: `invite-owner-${stamp}@coreknot-test.local`,
    });
    const owner = await User.create({
      name: 'Owner',
      email: `invite-owner-${stamp}@coreknot-test.local`,
      password: 'test-password-123',
      tenantId: tenant._id,
    });

    await expect(createInvite({
      tenantId: tenant._id,
      email: `new-${stamp}@coreknot-test.local`,
      invitedBy: owner._id,
    })).rejects.toMatchObject({ status: 400 });

    await expect(createInvite({
      tenantId: tenant._id,
      email: `bad-${stamp}@coreknot-test.local`,
      role: 'superuser',
      invitedBy: owner._id,
    })).rejects.toMatchObject({ status: 400 });

    const { invite } = await createInvite({
      tenantId: tenant._id,
      email: `new-${stamp}@coreknot-test.local`,
      role: 'admin',
      invitedBy: owner._id,
    });
    expect(invite.role).toBe('admin');
  });
});
