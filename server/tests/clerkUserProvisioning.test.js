jest.mock('@clerk/clerk-sdk-node', () => ({
  clerkClient: {
    users: {
      getUserList: jest.fn(),
      createUser: jest.fn(),
      updateUser: jest.fn(),
      getUser: jest.fn(),
      getOrganizationMembershipList: jest.fn(),
    },
    organizations: {
      createOrganizationMembership: jest.fn(),
    },
  },
}));

jest.mock('../utils/clerkAuth', () => ({
  isClerkConfigured: jest.fn(() => true),
}));

const { clerkClient } = require('@clerk/clerk-sdk-node');
const { isClerkConfigured } = require('../utils/clerkAuth');
const {
  provisionClerkUserForCoreKnotUser,
  syncClerkUserPassword,
} = require('../utils/clerkUserProvisioning');

describe('clerkUserProvisioning', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isClerkConfigured.mockReturnValue(true);
    process.env.CLERK_ORGANIZATION_ID = 'org_test';
    clerkClient.users.getUserList.mockResolvedValue({ data: [] });
    clerkClient.users.createUser.mockResolvedValue({ id: 'user_new' });
    clerkClient.users.getUser.mockResolvedValue({ id: 'user_new' });
    clerkClient.users.getOrganizationMembershipList.mockResolvedValue({ data: [] });
    clerkClient.organizations.createOrganizationMembership.mockResolvedValue({});
  });

  it('provisionClerkUserForCoreKnotUser creates Clerk user with password', async () => {
    const result = await provisionClerkUserForCoreKnotUser({
      email: 'new@example.com',
      name: 'New User',
      phone: '9876543210',
      plainPassword: 'TempPass9!',
      dbUserId: '507f1f77bcf86cd799439011',
    });

    expect(result).toEqual({ clerkUserId: 'user_new', created: true });
    expect(clerkClient.users.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        emailAddress: ['new@example.com'],
        password: 'TempPass9!',
      }),
    );
    expect(clerkClient.organizations.createOrganizationMembership).toHaveBeenCalled();
  });

  it('syncClerkUserPassword updates Clerk password', async () => {
    const result = await syncClerkUserPassword('user_abc', 'NewSecure9!');
    expect(result).toEqual({ synced: true });
    expect(clerkClient.users.updateUser).toHaveBeenCalledWith('user_abc', {
      password: 'NewSecure9!',
    });
  });

  it('syncClerkUserPassword no-ops when Clerk is not configured', async () => {
    isClerkConfigured.mockReturnValue(false);
    const result = await syncClerkUserPassword('user_abc', 'NewSecure9!');
    expect(result.synced).toBe(false);
    expect(clerkClient.users.updateUser).not.toHaveBeenCalled();
  });
});
