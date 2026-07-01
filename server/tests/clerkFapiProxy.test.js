const express = require('express');
const request = require('supertest');
const { buildTargetUrl } = require('../middleware/clerkFapiProxy');

describe('clerkFapiProxy', () => {
  const originalFetch = global.fetch;
  const originalSecret = process.env.CLERK_SECRET_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.CLERK_SECRET_KEY = originalSecret;
    jest.resetModules();
  });

  it('buildTargetUrl maps /__clerk paths to Clerk FAPI', () => {
    expect(buildTargetUrl({ originalUrl: '/__clerk/v1/environment' }))
      .toBe('https://clerk.tsccoreknot.com/v1/environment');
    expect(buildTargetUrl({ originalUrl: '/__clerk/npm/@clerk/clerk-js@6/dist/clerk.browser.js' }))
      .toBe('https://clerk.tsccoreknot.com/npm/@clerk/clerk-js@6/dist/clerk.browser.js');
  });

  it('buildTargetUrl honors CLERK_FAPI_UPSTREAM', () => {
    process.env.CLERK_FAPI_UPSTREAM = 'https://frontend-api.clerk.services';
    jest.resetModules();
    const { buildTargetUrl: build } = require('../middleware/clerkFapiProxy');
    expect(build({ originalUrl: '/__clerk/v1/environment' }))
      .toBe('https://frontend-api.clerk.services/v1/environment');
    delete process.env.CLERK_FAPI_UPSTREAM;
  });

  it('buildTargetUrl ignores CLERK_FRONTEND_API (custom domain is not proxy upstream)', () => {
    process.env.CLERK_FRONTEND_API = 'clerk.tsccoreknot.com';
    jest.resetModules();
    const { buildTargetUrl: build } = require('../middleware/clerkFapiProxy');
    expect(build({ originalUrl: '/__clerk/v1/environment' }))
      .toBe('https://frontend-api.clerk.services/v1/environment');
    delete process.env.CLERK_FRONTEND_API;
  });

  it('returns 503 when CLERK_SECRET_KEY is missing', async () => {
    delete process.env.CLERK_SECRET_KEY;
    const router = require('../middleware/clerkFapiProxy');
    const app = express();
    app.use('/__clerk', router);

    const res = await request(app).get('/__clerk/v1/environment');
    expect(res.status).toBe(503);
  });

  it('proxies GET with Clerk proxy headers', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_proxy';
    global.fetch = jest.fn(async () => ({
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      arrayBuffer: async () => Buffer.from('{"ok":true}'),
    }));

    const router = require('../middleware/clerkFapiProxy');
    const app = express();
    app.set('trust proxy', 1);
    app.use('/__clerk', router);

    const res = await request(app)
      .get('/__clerk/v1/environment')
      .set('X-Forwarded-For', '203.0.113.1');

    expect(res.status).toBe(200);
    expect(res.text).toBe('{"ok":true}');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, init] = global.fetch.mock.calls[0];
    expect(init.headers.get('Clerk-Secret-Key')).toBe('sk_test_proxy');
    expect(init.headers.get('Clerk-Proxy-Url')).toBe('https://tsccoreknot.com/__clerk');
    expect(init.headers.get('host')).toBe('clerk.tsccoreknot.com');
    expect(init.headers.get('X-Forwarded-For')).toBe('203.0.113.1');
  });
});
