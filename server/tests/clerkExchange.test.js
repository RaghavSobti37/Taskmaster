const request = require('supertest');
const app = require('../server');
const User = require('../models/User');

jest.mock('../utils/clerkAuth', () => ({
  isClerkConfigured: jest.fn(),
  verifyClerkSessionToken: jest.fn(),
  loadClerkProfile: jest.fn(),
}));

const {
  isClerkConfigured,
  verifyClerkSessionToken,
  loadClerkProfile,
} = require('../utils/clerkAuth');

describe('POST /api/auth/clerk-exchange', () => {
  beforeEach(async () => {
    await User.deleteMany();
    jest.clearAllMocks();
    isClerkConfigured.mockReturnValue(true);
  });

  it('returns 503 when Clerk is not configured', async () => {
    isClerkConfigured.mockReturnValue(false);

    const res = await request(app)
      .post('/api/auth/clerk-exchange')
      .set('Authorization', 'Bearer clerk-token');

    expect(res.statusCode).toBe(503);
    expect(res.body.error).toMatch(/not configured/i);
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).post('/api/auth/clerk-exchange');
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/missing/i);
  });

  it('links an existing user by email and sets coreknot session cookie', async () => {
    const user = await User.create({
      name: 'Existing User',
      email: 'existing@example.com',
      password: 'TempPass123!',
    });

    verifyClerkSessionToken.mockResolvedValue({ sub: 'user_clerk_123' });
    loadClerkProfile.mockResolvedValue({
      clerkId: 'user_clerk_123',
      email: 'existing@example.com',
      name: 'Existing User',
      avatar: 'https://example.com/avatar.png',
    });

    const res = await request(app)
      .post('/api/auth/clerk-exchange')
      .set('Authorization', 'Bearer valid-clerk-token');

    expect(res.statusCode).toBe(200);
    expect(res.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('coreknot_token_v3=')]),
    );
    expect(res.body.email).toBe('existing@example.com');

    const updated = await User.findById(user._id);
    expect(updated.clerkId).toBe('user_clerk_123');
  });

  it('creates a new user when Clerk identity is unknown', async () => {
    verifyClerkSessionToken.mockResolvedValue({ sub: 'user_clerk_new' });
    loadClerkProfile.mockResolvedValue({
      clerkId: 'user_clerk_new',
      email: 'new@example.com',
      name: 'New Clerk User',
    });

    const res = await request(app)
      .post('/api/auth/clerk-exchange')
      .set('Authorization', 'Bearer valid-clerk-token');

    expect(res.statusCode).toBe(200);
    expect(res.body.email).toBe('new@example.com');

    const created = await User.findOne({ email: 'new@example.com' });
    expect(created.clerkId).toBe('user_clerk_new');
    expect(created.mustChangePassword).toBe(true);
  });
});
