const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SPA_CATCHALL_SOURCE,
  composeRewrites,
  buildPostHogRewrites,
  buildClerkProxyRewriteSatellite,
  existingRewritesLookValid,
} = require('./generateVercelConfig.cjs');

const templateRewrites = [
  { source: '/api/(.*)', destination: 'https://YOUR-RENDER-SERVICE.onrender.com/api/$1' },
  { source: '/socket.io/(.*)', destination: 'https://YOUR-RENDER-SERVICE.onrender.com/socket.io/$1' },
  { source: '/((?!api/)(?!.*\\.[^/]+$).*)', destination: '/index.html' },
];

const apiDestination = 'https://api.example.onrender.com/api/$1';
const socketDestination = 'https://api.example.onrender.com/socket.io/$1';
const PROD_API = 'https://coreknot-api.onrender.com';

test('composeRewrites places PostHog proxy before SPA catch-all', () => {
  const rewrites = composeRewrites(templateRewrites, apiDestination, socketDestination);
  const catchallIdx = rewrites.findIndex((rule) => rule.source === SPA_CATCHALL_SOURCE);
  const firstPhIdx = rewrites.findIndex((rule) => String(rule.source).startsWith('/ph/'));
  const clerkIdx = rewrites.findIndex((rule) => rule.source === '/__clerk/:path*');

  assert.ok(catchallIdx >= 0, 'SPA catch-all present');
  assert.ok(firstPhIdx >= 0, 'PostHog proxy present');
  assert.ok(clerkIdx >= 0, 'Clerk proxy present');
  assert.ok(clerkIdx < catchallIdx, 'Clerk proxy must precede SPA catch-all');
  assert.ok(firstPhIdx < catchallIdx, 'PostHog must precede SPA catch-all');
});

test('composeRewrites drops duplicate PostHog rules from template', () => {
  const withDupes = [
    ...templateRewrites,
    ...buildPostHogRewrites(),
  ];
  const rewrites = composeRewrites(withDupes, apiDestination, socketDestination);
  const phRules = rewrites.filter((rule) => String(rule.source).startsWith('/ph/'));

  assert.equal(phRules.length, 3);
});

test('PostHog proxy rewrites use hungry regex so trailing-slash endpoints (/decide/, /e/) are not dropped', () => {
  const rules = buildPostHogRewrites();
  assert.equal(rules.length, 3);
  for (const rule of rules) {
    assert.ok(
      rule.source.endsWith(':path(.*)'),
      `source must end with :path(.*) not :path* — got "${rule.source}"`,
    );
    assert.ok(
      !rule.destination.includes(':path*'),
      `destination must reference :path not :path* — got "${rule.destination}"`,
    );
    assert.ok(
      rule.destination.endsWith(':path'),
      `destination must end with :path — got "${rule.destination}"`,
    );
  }
});

test('buildClerkProxyRewriteSatellite proxies directly to Render (no primary-app double hop)', () => {
  const rule = buildClerkProxyRewriteSatellite(apiDestination);
  assert.equal(rule.source, '/__clerk/:path*');
  assert.equal(rule.destination, 'https://api.example.onrender.com/__clerk/:path*');
});

test('existingRewritesLookValid accepts live Render host, rejects placeholder', () => {
  assert.equal(
    existingRewritesLookValid({
      rewrites: [{ source: '/api/(.*)', destination: 'https://coreknot-api.onrender.com/api/$1' }],
    }),
    true,
  );
  assert.equal(
    existingRewritesLookValid({
      rewrites: [{ source: '/api/(.*)', destination: 'https://YOUR-RENDER-SERVICE.onrender.com/api/$1' }],
    }),
    false,
  );
});

test('pickProxyUrl uses production API on Vercel preview', () => {
  const prev = { ...process.env };
  process.env.VERCEL_ENV = 'preview';
  process.env.VITE_API_URL = PROD_API;
  delete process.env.RENDER_API_PROXY_URL;
  const { pickProxyUrl } = require('./generateVercelConfig.cjs');
  assert.equal(pickProxyUrl(), PROD_API);
  process.env = prev;
});

test('pickProxyUrl skips retired staging host and falls back to production env', () => {
  const prev = { ...process.env };
  process.env.VERCEL_ENV = 'preview';
  process.env.RENDER_API_PROXY_URL = 'https://coreknot-api-staging.onrender.com';
  process.env.VITE_API_URL = PROD_API;
  const { pickProxyUrl } = require('./generateVercelConfig.cjs');
  assert.equal(pickProxyUrl(), PROD_API);
  process.env = prev;
});

test('pickProxyUrl uses production when VERCEL=1 but VERCEL_ENV unset', () => {
  const prev = { ...process.env };
  process.env.VERCEL = '1';
  delete process.env.VERCEL_ENV;
  process.env.VITE_API_URL = PROD_API;
  delete process.env.RENDER_API_PROXY_URL;
  const { pickProxyUrl } = require('./generateVercelConfig.cjs');
  assert.equal(pickProxyUrl(), PROD_API);
  process.env = prev;
});

test('buildVercelSecurityHeaders adds preview CSP allowances', () => {
  const { buildContentSecurityPolicy, buildVercelHeaders } = require('./vercelSecurityHeaders.cjs');
  const preview = buildContentSecurityPolicy({ isPreview: true });
  assert.ok(preview.includes('https://vercel.live'));
  assert.ok(preview.includes('manifest-src'));
  const prod = buildContentSecurityPolicy({ isPreview: false });
  assert.ok(prod.includes('https://vercel.live'));

  const templateHeaders = [
    {
      source: '/(.*)',
      headers: [{ key: 'Content-Security-Policy', value: prod }],
    },
    { source: '/', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
  ];
  const merged = buildVercelHeaders(templateHeaders, { isPreview: true });
  const csp = merged.find((block) => block.source === '/(.*)')?.headers
    .find((h) => h.key === 'Content-Security-Policy')?.value;
  assert.ok(csp?.includes('https://vercel.live'));
});
