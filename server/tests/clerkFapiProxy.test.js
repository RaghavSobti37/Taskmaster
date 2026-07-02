const express = require('express');
const request = require('supertest');
const { buildTargetUrl, buildProxyPublicUrl } = require('../middleware/clerkFapiProxy');

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
      .toBe('https://frontend-api.clerk.dev/v1/environment');
    expect(buildTargetUrl({ originalUrl: '/__clerk/npm/@clerk/clerk-js@6/dist/clerk.browser.js' }))
      .toBe('https://frontend-api.clerk.dev/npm/@clerk/clerk-js@6/dist/clerk.browser.js');
  });

  it('buildTargetUrl ignores CLERK_FRONTEND_API (custom domain is not proxy upstream)', () => {
    process.env.CLERK_FRONTEND_API = 'clerk.tsccoreknot.com';
    jest.resetModules();
    const { buildTargetUrl: build } = require('../middleware/clerkFapiProxy');
    expect(build({ originalUrl: '/__clerk/v1/environment' }))
      .toBe('https://frontend-api.clerk.dev/v1/environment');
    delete process.env.CLERK_FRONTEND_API;
  });

  it('buildProxyPublicUrl uses auth satellite host when forwarded', () => {
    const req = { headers: { 'x-forwarded-host': 'auth.tsccoreknot.com' } };
    expect(buildProxyPublicUrl(req)).toBe('https://auth.tsccoreknot.com/__clerk');
  });

  it('buildProxyPublicUrl falls back to env default on app host', () => {
    process.env.CLERK_PROXY_PUBLIC_URL = 'https://tsccoreknot.com/__clerk';
    const req = { headers: { 'x-forwarded-host': 'tsccoreknot.com' } };
    expect(buildProxyPublicUrl(req)).toBe('https://tsccoreknot.com/__clerk');
    delete process.env.CLERK_PROXY_PUBLIC_URL;
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
      .set('X-Forwarded-For', '203.0.113.1')
      .set('X-Forwarded-Host', 'auth.tsccoreknot.com');

    expect(res.status).toBe(200);
    expect(res.text).toBe('{"ok":true}');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, init] = global.fetch.mock.calls[0];
    expect(init.headers.get('Clerk-Secret-Key')).toBe('sk_test_proxy');
    expect(init.headers.get('Clerk-Proxy-Url')).toBe('https://auth.tsccoreknot.com/__clerk');
    expect(init.headers.get('X-Forwarded-For')).toBe('203.0.113.1');
  });

  it('follows upstream redirect and returns final body without Location header', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_proxy';
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        status: 307,
        headers: new Headers({
          location: 'https://frontend-api.clerk.dev/npm/@clerk/clerk-js@6.23.0/dist/clerk.browser.js',
        }),
        arrayBuffer: async () => Buffer.from(''),
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: new Headers({ 'content-type': 'application/javascript' }),
        arrayBuffer: async () => Buffer.from('/* clerk */'),
      });

    const router = require('../middleware/clerkFapiProxy');
    const app = express();
    app.use('/__clerk', router);

    const res = await request(app).get('/__clerk/npm/@clerk/clerk-js@6/dist/clerk.browser.js');
    expect(res.status).toBe(200);
    expect(res.text).toBe('/* clerk */');
    expect(res.headers.location).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
