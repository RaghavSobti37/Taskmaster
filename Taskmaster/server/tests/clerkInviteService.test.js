jest.mock('@clerk/clerk-sdk-node', () => ({
  clerkClient: {
    organizations: {
      createOrganizationInvitation: jest.fn(),
    },
  },
}));

jest.mock('../utils/clerkAuth', () => ({
  isClerkConfigured: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../services/planEnforcementService', () => ({
  assertSeatAvailable: jest.fn().mockResolvedValue(undefined),
}));

const { clerkClient } = require('@clerk/clerk-sdk-node');
const { isClerkConfigured } = require('../utils/clerkAuth');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const TenantInvite = require('../models/TenantInvite');
const {
  isClerkIdentityWritePathEnabled,
  createClerkOrganizationInvitation,
} = require('../services/clerkInviteService');
const { createInvite } = require('../services/tenantMembershipService');
const { CLERK_ORG_ADMIN_ROLE } = require('../utils/clerkRoleMapping');

describe('clerkInviteService', () => {
  const prevFlag = process.env.CLERK_IDENTITY_WRITE_PATH;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CLERK_IDENTITY_WRITE_PATH = 'true';
    isClerkConfigured.mockReturnValue(true);
    clerkClient.organizations.createOrganizationInvitation.mockResolvedValue({
      id: 'orginv_test_1',
      expiresAt: Date.now() + 86400000,
    });
  });

  afterEach(() => {
    if (prevFlag === undefined) delete process.env.CLERK_IDENTITY_WRITE_PATH;
    else process.env.CLERK_IDENTITY_WRITE_PATH = prevFlag;
  });

  it('isClerkIdentityWritePathEnabled respects env flag', () => {
    process.env.CLERK_IDENTITY_WRITE_PATH = 'true';
    expect(isClerkIdentityWritePathEnabled()).toBe(true);
    process.env.CLERK_IDENTITY_WRITE_PATH = 'false';
    expect(isClerkIdentityWritePathEnabled()).toBe(false);
  });

  it('createClerkOrganizationInvitation calls Clerk with mapped role', async () => {
    const owner = await User.create({
      name: 'Invite Owner',
      email: `invite-owner-${Date.now()}@example.com`,
      clerkId: 'user_inviter',
    });
    const tenant = await Tenant.create({
      name: 'Clerk Invite Org',
      slug: `clerk-invite-${Date.now().toString(36)}`,
      contactEmail: owner.email,
      ownerId: owner._id,
      clerkOrganizationId: 'org_invite_test',
    });

    const result = await createClerkOrganizationInvitation({
      tenantId: tenant._id,
      email: 'newmember@example.com',
      role: 'admin',
      invitedBy: owner._id,
    });

    expect(result.source).toBe('clerk');
    expect(result.clerkInvitationId).toBe('orginv_test_1');
    expect(result.email).toBe('newmember@example.com');
    expect(result.role).toBe('admin');
    expect(clerkClient.organizations.createOrganizationInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_invite_test',
        emailAddress: 'newmember@example.com',
        role: CLERK_ORG_ADMIN_ROLE,
        inviterUserId: 'user_inviter',
      }),
    );
    const mongoInvites = await TenantInvite.find({ tenantId: tenant._id }).setOptions({ bypassTenant: true });
    expect(mongoInvites).toHaveLength(0);
  });

  it('rejects when tenant lacks clerkOrganizationId', async () => {
    const tenant = await Tenant.create({
      name: 'No Clerk Org',
      slug: `no-clerk-${Date.now().toString(36)}`,
      contactEmail: 'no-clerk@example.com',
    });

    await expect(createClerkOrganizationInvitation({
      tenantId: tenant._id,
      email: 'x@example.com',
      role: 'member',
      invitedBy: null,
    })).rejects.toMatchObject({ status: 409 });
  });

  it('createInvite uses legacy Mongo path when flag off', async () => {
    process.env.CLERK_IDENTITY_WRITE_PATH = 'false';
    const owner = await User.create({
      name: 'Legacy Owner',
      email: `legacy-owner-${Date.now()}@example.com`,
    });
    const tenant = await Tenant.create({
      name: 'Legacy Invite Org',
      slug: `legacy-invite-${Date.now().toString(36)}`,
      contactEmail: owner.email,
      clerkOrganizationId: 'org_legacy',
    });

    const result = await createInvite({
      tenantId: tenant._id,
      email: 'legacy@example.com',
      role: 'member',
      invitedBy: owner._id,
    });

    expect(result.invite).toBeTruthy();
    expect(result.token).toBeTruthy();
    expect(result.source).toBeUndefined();
    expect(clerkClient.organizations.createOrganizationInvitation).not.toHaveBeenCalled();
  });

  it('createInvite delegates to Clerk when flag on', async () => {
    const owner = await User.create({
      name: 'Flag Owner',
      email: `flag-owner-${Date.now()}@example.com`,
      clerkId: 'user_flag',
    });
    const tenant = await Tenant.create({
      name: 'Flag Invite Org',
      slug: `flag-invite-${Date.now().toString(36)}`,
      contactEmail: owner.email,
      clerkOrganizationId: 'org_flag',
    });

    const result = await createInvite({
      tenantId: tenant._id,
      email: 'flag@example.com',
      role: 'member',
      invitedBy: owner._id,
    });

    expect(result.source).toBe('clerk');
    expect(result.clerkInvitationId).toBe('orginv_test_1');
    expect(clerkClient.organizations.createOrganizationInvitation).toHaveBeenCalled();
  });
});
