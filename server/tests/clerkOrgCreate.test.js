jest.mock('@clerk/clerk-sdk-node', () => ({
  clerkClient: {
    organizations: {
      createOrganization: jest.fn(),
      createOrganizationMembership: jest.fn(),
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

const { clerkClient } = require('@clerk/clerk-sdk-node');
const { isClerkConfigured } = require('../utils/clerkAuth');
const {
  CLERK_ORG_ADMIN_ROLE,
  syncTenantToClerkOrganization,
} = require('../services/clerkOrgService');

describe('clerkOrgService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isClerkConfigured.mockReturnValue(true);
    clerkClient.organizations.createOrganization.mockResolvedValue({ id: 'org_new' });
    clerkClient.organizations.createOrganizationMembership.mockResolvedValue({});
  });

  it('creates Clerk org and adds creator as org admin', async () => {
    const result = await syncTenantToClerkOrganization({
      tenantName: 'Acme Corp',
      slug: 'acme-corp',
      creatorClerkId: 'user_creator',
      creatorUserId: '507f1f77bcf86cd799439011',
    });

    expect(result).toEqual({ synced: true, clerkOrganizationId: 'org_new' });
    expect(clerkClient.organizations.createOrganization).toHaveBeenCalledWith({
      name: 'Acme Corp',
      slug: 'acme-corp',
      createdBy: 'user_creator',
    });
    expect(clerkClient.organizations.createOrganizationMembership).toHaveBeenCalledWith({
      organizationId: 'org_new',
      userId: 'user_creator',
      role: CLERK_ORG_ADMIN_ROLE,
    });
  });

  it('skips sync when Clerk is not configured', async () => {
    isClerkConfigured.mockReturnValue(false);

    const result = await syncTenantToClerkOrganization({
      tenantName: 'Acme Corp',
      slug: 'acme-corp',
      creatorClerkId: 'user_creator',
    });

    expect(result).toEqual({ synced: false, reason: 'not_configured' });
    expect(clerkClient.organizations.createOrganization).not.toHaveBeenCalled();
  });

  it('skips sync when creator has no clerkId', async () => {
    const result = await syncTenantToClerkOrganization({
      tenantName: 'Acme Corp',
      slug: 'acme-corp',
      creatorClerkId: null,
      creatorUserId: '507f1f77bcf86cd799439011',
    });

    expect(result).toEqual({ synced: false, reason: 'no_clerk_user' });
    expect(clerkClient.organizations.createOrganization).not.toHaveBeenCalled();
  });

  it('treats already-member membership error as success', async () => {
    clerkClient.organizations.createOrganizationMembership.mockRejectedValue(
      new Error('User is already a member of the organization'),
    );

    const result = await syncTenantToClerkOrganization({
      tenantName: 'Acme Corp',
      slug: 'acme-corp',
      creatorClerkId: 'user_creator',
    });

    expect(result).toEqual({ synced: true, clerkOrganizationId: 'org_new' });
  });

  it('returns failure reason when org create throws', async () => {
    clerkClient.organizations.createOrganization.mockRejectedValue(new Error('rate limited'));

    const result = await syncTenantToClerkOrganization({
      tenantName: 'Acme Corp',
      slug: 'acme-corp',
      creatorClerkId: 'user_creator',
    });

    expect(result.synced).toBe(false);
    expect(result.reason).toMatch(/rate limited/i);
  });
});
