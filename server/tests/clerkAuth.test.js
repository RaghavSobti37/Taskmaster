jest.mock('@clerk/clerk-sdk-node', () => ({
  verifyToken: jest.fn(),
  clerkClient: {
    users: {
      getUser: jest.fn(),
    },
  },
}));

const { verifyToken, clerkClient } = require('@clerk/clerk-sdk-node');
const {
  isClerkConfigured,
  verifyClerkSessionToken,
  primaryClerkEmail,
} = require('../utils/clerkAuth');

describe('clerkAuth', () => {
  const originalSecret = process.env.CLERK_SECRET_KEY;

  afterEach(() => {
    process.env.CLERK_SECRET_KEY = originalSecret;
    jest.clearAllMocks();
  });

  it('isClerkConfigured is false without secret', () => {
    delete process.env.CLERK_SECRET_KEY;
    expect(isClerkConfigured()).toBe(false);
  });

  it('isClerkConfigured is false for mock secret', () => {
    process.env.CLERK_SECRET_KEY = 'mock_clerk_secret';
    expect(isClerkConfigured()).toBe(false);
  });

  it('verifyClerkSessionToken returns profile on valid token', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_real';
    verifyToken.mockResolvedValue({ sub: 'user_abc' });
    clerkClient.users.getUser.mockResolvedValue({
      id: 'user_abc',
      firstName: 'Ada',
      lastName: 'Lovelace',
      primaryEmailAddressId: 'em_1',
      emailAddresses: [{ id: 'em_1', emailAddress: 'Ada@Example.com' }],
    });

    const profile = await verifyClerkSessionToken('session_jwt');
    expect(profile).toEqual({
      clerkUserId: 'user_abc',
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      clerkOrganizationId: null,
    });
  });

  it('verifyClerkSessionToken returns null on verify failure', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_real';
    verifyToken.mockRejectedValue(new Error('invalid'));

    await expect(verifyClerkSessionToken('bad')).resolves.toBeNull();
  });

  it('primaryClerkEmail picks primary address', () => {
    const email = primaryClerkEmail({
      primaryEmailAddressId: 'em_2',
      emailAddresses: [
        { id: 'em_1', emailAddress: 'old@example.com' },
        { id: 'em_2', emailAddress: 'Primary@Example.com' },
      ],
    });
    expect(email).toBe('primary@example.com');
  });
});
