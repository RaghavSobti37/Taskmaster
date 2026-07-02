const {
  emailDomain,
  matchesAllowedDomain,
  pinnedClerkOrganizationId,
  resolveClerkOrganizationId,
  ensureClerkOrganizationAccess,
  shouldEnforceClerkOrganization,
} = require('../utils/organizationAccess');

describe('organizationAccess', () => {
  const originalOrg = process.env.CLERK_ORGANIZATION_ID;
  const originalAdmin = process.env.ADMIN_EMAIL;
  const originalDomain = process.env.ALLOWED_DOMAIN;

  afterEach(() => {
    process.env.CLERK_ORGANIZATION_ID = originalOrg;
    process.env.ADMIN_EMAIL = originalAdmin;
    process.env.ALLOWED_DOMAIN = originalDomain;
  });

  it('emailDomain extracts host', () => {
    expect(emailDomain('Ada@TheShaktiCollective.in')).toBe('theshakticollective.in');
  });

  it('matchesAllowedDomain compares case-insensitively', () => {
    expect(matchesAllowedDomain('user@TheShaktiCollective.in', 'theshakticollective.in')).toBe(true);
    expect(matchesAllowedDomain('user@gmail.com', 'theshakticollective.in')).toBe(false);
  });

  it('resolveClerkOrganizationId prefers pinned env', () => {
    process.env.CLERK_ORGANIZATION_ID = 'org_pinned';
    expect(resolveClerkOrganizationId({
      bodyOrganizationId: 'org_body',
      tokenOrganizationId: 'org_token',
    })).toBe('org_pinned');
  });

  it('shouldEnforceClerkOrganization is opt-in via CLERK_REQUIRE_ORGANIZATION', () => {
    delete process.env.CLERK_REQUIRE_ORGANIZATION;
    expect(shouldEnforceClerkOrganization()).toBe(false);
    process.env.CLERK_REQUIRE_ORGANIZATION = 'true';
    expect(shouldEnforceClerkOrganization()).toBe(true);
    process.env.CLERK_REQUIRE_ORGANIZATION = 'TRUE';
    expect(shouldEnforceClerkOrganization()).toBe(true);
    process.env.CLERK_REQUIRE_ORGANIZATION = '0';
    expect(shouldEnforceClerkOrganization()).toBe(false);
  });

  it('ensureClerkOrganizationAccess is no-op without organization id', async () => {
    const clerkClient = {
      users: { getOrganizationMembershipList: jest.fn() },
      organizations: { createOrganizationMembership: jest.fn() },
    };

    const result = await ensureClerkOrganizationAccess({
      clerkClient,
      clerkUserId: 'user_0',
      email: 'user@example.com',
      clerkOrganizationId: null,
      tenant: null,
    });

    expect(result.reason).toBe('none');
    expect(clerkClient.users.getOrganizationMembershipList).not.toHaveBeenCalled();
  });

  it('ensureClerkOrganizationAccess allows existing members', async () => {
    const clerkClient = {
      users: {
        getOrganizationMembershipList: jest.fn().mockResolvedValue({
          data: [{ organization: { id: 'org_tsc' } }],
        }),
      },
      organizations: {
        createOrganizationMembership: jest.fn(),
      },
    };

    const result = await ensureClerkOrganizationAccess({
      clerkClient,
      clerkUserId: 'user_1',
      email: 'guest@gmail.com',
      clerkOrganizationId: 'org_tsc',
      tenant: { allowedEmailDomain: 'theshakticollective.in' },
    });

    expect(result.reason).toBe('member');
    expect(clerkClient.organizations.createOrganizationMembership).not.toHaveBeenCalled();
  });

  it('ensureClerkOrganizationAccess auto-joins matching domain', async () => {
    const clerkClient = {
      users: {
        getOrganizationMembershipList: jest.fn().mockResolvedValue({ data: [] }),
      },
      organizations: {
        createOrganizationMembership: jest.fn().mockResolvedValue({}),
      },
    };

    const result = await ensureClerkOrganizationAccess({
      clerkClient,
      clerkUserId: 'user_2',
      email: 'new@theshakticollective.in',
      clerkOrganizationId: 'org_tsc',
      tenant: { allowedEmailDomain: 'theshakticollective.in' },
    });

    expect(result.reason).toBe('verified_domain');
    expect(clerkClient.organizations.createOrganizationMembership).toHaveBeenCalledWith({
      organizationId: 'org_tsc',
      userId: 'user_2',
      role: 'org:member',
    });
  });

  it('ensureClerkOrganizationAccess rejects outsiders', async () => {
    const clerkClient = {
      users: {
        getOrganizationMembershipList: jest.fn().mockResolvedValue({ data: [] }),
      },
      organizations: {
        createOrganizationMembership: jest.fn(),
      },
    };

    await expect(ensureClerkOrganizationAccess({
      clerkClient,
      clerkUserId: 'user_3',
      email: 'outsider@gmail.com',
      clerkOrganizationId: 'org_tsc',
      tenant: { allowedEmailDomain: 'theshakticollective.in' },
    })).rejects.toMatchObject({ status: 403 });
  });
});
