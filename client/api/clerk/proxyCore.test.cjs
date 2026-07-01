const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTargetUrl, proxyClerkRequest } = require('./proxyCore.cjs');

test('buildTargetUrl maps path suffix to FAPI base', () => {
  process.env.CLERK_FAPI_UPSTREAM = 'https://clerk.tsccoreknot.com';
  assert.equal(buildTargetUrl('v1/environment'), 'https://clerk.tsccoreknot.com/v1/environment');
  delete process.env.CLERK_FAPI_UPSTREAM;
});

test('proxyClerkRequest returns 503 without secret', async () => {
  const prev = process.env.CLERK_SECRET_KEY;
  delete process.env.CLERK_SECRET_KEY;
  const res = await proxyClerkRequest({ method: 'GET', pathSuffix: 'v1/environment', headers: {} });
  assert.equal(res.status, 503);
  process.env.CLERK_SECRET_KEY = prev;
});

test('proxyClerkRequest forwards Clerk proxy headers', async () => {
  process.env.CLERK_SECRET_KEY = 'sk_test_proxy';
  const originalFetch = global.fetch;
  global.fetch = async (url, init) => {
    assert.equal(url, 'https://frontend-api.clerk.services/v1/environment');
    assert.equal(init.headers.get('Clerk-Secret-Key'), 'sk_test_proxy');
    assert.equal(init.headers.get('Clerk-Proxy-Url'), 'https://tsccoreknot.com/__clerk');
    return {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      arrayBuffer: async () => Buffer.from('{"ok":true}'),
    };
  };
  delete process.env.CLERK_FAPI_UPSTREAM;
  const res = await proxyClerkRequest({
    method: 'GET',
    pathSuffix: 'v1/environment',
    headers: { 'x-forwarded-for': '203.0.113.1' },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.toString(), '{"ok":true}');
  global.fetch = originalFetch;
});
