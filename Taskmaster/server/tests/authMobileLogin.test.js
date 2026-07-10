const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const { getCookieOptions } = require('../utils/authCookie');
const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');

const TEST_PASSWORD = DEV_DEFAULT_PASSWORD;
const MOBILE_PROXY_HEADERS = {
  'X-Forwarded-Host': 'tsccoreknot.com',
  Origin: 'https://tsccoreknot.com',
};

const seedUser = async (email) => {
  await User.create({
    name: 'Mobile User',
    email,
    password: TEST_PASSWORD,
    gender: 'male',
  });
};

describe('Mobile proxied login (Vercel /api → Render)', () => {
  beforeEach(async () => {
    await User.deleteMany();
  });

  it('production proxy headers yield Lax cookie options (iOS-safe)', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const req = {
        get: (h) => {
          if (h === 'x-forwarded-host') return 'tsccoreknot.com';
          if (h === 'host') return 'taskmaster-jfw0.onrender.com';
          return undefined;
        },
      };
      const opts = getCookieOptions(req);
      expect(opts.sameSite).toBe('lax');
      expect(opts.partitioned).toBeUndefined();
      expect(opts.secure).toBe(true);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('login → /me → logout → re-login with mobile proxy headers', async () => {
    await seedUser('mobile@example.com');

    const agent = request.agent(app);

    const loginRes = await agent
      .post('/api/auth/login')
      .set(MOBILE_PROXY_HEADERS)
      .send({ email: 'mobile@example.com', password: TEST_PASSWORD });

    expect(loginRes.statusCode).toBe(200);
    const cookies = loginRes.headers['set-cookie'] || [];
    const sessionCookie = cookies.find(
      (row) => row.startsWith('coreknot_token_v3=') && !row.includes('max-age=0'),
    );
    expect(sessionCookie).toBeDefined();

    const meRes = await agent.get('/api/auth/me').set(MOBILE_PROXY_HEADERS);
    expect(meRes.statusCode).toBe(200);
    expect(meRes.body.email).toBe('mobile@example.com');

    await agent.post('/api/auth/logout').set(MOBILE_PROXY_HEADERS);

    const reloginRes = await agent
      .post('/api/auth/login')
      .set(MOBILE_PROXY_HEADERS)
      .send({ email: 'mobile@example.com', password: TEST_PASSWORD });

    expect(reloginRes.statusCode).toBe(200);
    const meAgain = await agent.get('/api/auth/me').set(MOBILE_PROXY_HEADERS);
    expect(meAgain.statusCode).toBe(200);
    expect(meAgain.body.email).toBe('mobile@example.com');
  });

  it('re-login works when stale legacy cookies are sent on the request', async () => {
    await seedUser('legacy@example.com');

    const agent = request.agent(app);

    const loginRes = await agent
      .post('/api/auth/login')
      .set({
        ...MOBILE_PROXY_HEADERS,
        Cookie: 'coreknot_token_v2=stale.jwt.value; coreknot_token=older.jwt.value',
      })
      .send({ email: 'legacy@example.com', password: TEST_PASSWORD });

    expect(loginRes.statusCode).toBe(200);
    const meRes = await agent.get('/api/auth/me').set(MOBILE_PROXY_HEADERS);
    expect(meRes.statusCode).toBe(200);
  });
});
