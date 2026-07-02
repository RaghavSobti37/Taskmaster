const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const { mintSessionAgent } = require('./helpers/mintTestSession');

const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');

const TEST_PASSWORD = DEV_DEFAULT_PASSWORD;

describe('Authentication API', () => {
  beforeEach(async () => {
    await User.deleteMany();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: TEST_PASSWORD,
          gender: 'male',
        });

      expect(res.statusCode).toEqual(201);
      expect(res.headers['set-cookie']).toEqual(
        expect.arrayContaining([expect.stringContaining('coreknot_token_v3=')])
      );
      expect(res.body).not.toHaveProperty('token');
      expect(res.body.email).toEqual('test@example.com');
      expect(res.body).not.toHaveProperty('password');
    });

    it('should prevent NoSQL injection via object payloads', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: { $ne: 'test' },
          email: { $ne: 'test@example.com' },
          password: { $gt: '' },
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('error', 'Invalid input format');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: TEST_PASSWORD,
          gender: 'male',
        });
    });

    it('should login an existing user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: TEST_PASSWORD,
        });

      expect(res.statusCode).toEqual(200);
      expect(res.headers['set-cookie']).toEqual(
        expect.arrayContaining([expect.stringContaining('coreknot_token_v3=')])
      );
      expect(res.body).not.toHaveProperty('token');
    });

    it('should reject invalid credentials format (NoSQL injection prevention)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: { $ne: 'test@example.com' },
          password: { $gt: '' },
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('error', 'Invalid input format');
    });

    it('should login by normalized display name (case-insensitive)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test user',
          password: TEST_PASSWORD,
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.email).toEqual('test@example.com');
    });

    it('blocks suspended user login and protected route access', async () => {
      const created = await User.findOne({ email: 'test@example.com' }).setOptions({ bypassTenant: true });
      created.suspended = true;
      created.suspendedAt = new Date();
      await created.save();

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: TEST_PASSWORD,
        });
      expect(loginRes.statusCode).toEqual(403);
      expect(String(loginRes.body.error || '')).toMatch(/suspended/i);

      const agent = request.agent(app);
      await User.updateOne({ email: 'test@example.com' }, { $set: { suspended: false, suspendedAt: null } })
        .setOptions({ bypassTenant: true });
      await mintSessionAgent(agent, created._id);

      await User.updateOne({ email: 'test@example.com' }, { $set: { suspended: true, suspendedAt: new Date() } })
        .setOptions({ bypassTenant: true });
      const meRes = await agent.get('/api/auth/me');
      expect(meRes.statusCode).toEqual(403);
      expect(String(meRes.body.error || '')).toMatch(/suspended/i);
    });
  });

  describe('GET /api/auth/session', () => {
    it('returns 200 authenticated false when logged out', async () => {
      const res = await request(app).get('/api/auth/session');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toMatchObject({ authenticated: false });
      expect(res.body.traceId).toEqual(expect.any(String));
    });

    it('returns authenticated true with user when logged in', async () => {
      const reg = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Session User',
          email: 'session@example.com',
          password: TEST_PASSWORD,
          gender: 'male',
        });

      const agent = request.agent(app);
      await mintSessionAgent(agent, reg.body._id);

      const res = await agent.get('/api/auth/session');
      expect(res.statusCode).toEqual(200);
      expect(res.body.authenticated).toBe(true);
      expect(res.body.user.email).toEqual('session@example.com');
    });
  });

  describe('Clerk-only production guards', () => {
    const prevSecret = process.env.CLERK_SECRET_KEY;
    const prevAllowLegacy = process.env.ALLOW_LEGACY_LOGIN;

    beforeAll(() => {
      process.env.CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || 'sk_test_clerk_only_gate';
      delete process.env.ALLOW_LEGACY_LOGIN;
    });

    afterAll(() => {
      if (prevSecret === undefined) delete process.env.CLERK_SECRET_KEY;
      else process.env.CLERK_SECRET_KEY = prevSecret;
      if (prevAllowLegacy === undefined) delete process.env.ALLOW_LEGACY_LOGIN;
      else process.env.ALLOW_LEGACY_LOGIN = prevAllowLegacy;
    });

    it('returns 410 for password login when Clerk is configured', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: TEST_PASSWORD });
      expect(res.statusCode).toEqual(410);
    });

    it('returns 410 for register when Clerk is configured', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Blocked',
          email: 'blocked@example.com',
          password: TEST_PASSWORD,
          gender: 'male',
        });
      expect(res.statusCode).toEqual(410);
    });
  });
});
