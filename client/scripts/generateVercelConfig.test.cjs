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
  // Vercel's :path* wildcard fails to match segments ending in "/" (e.g. "/ph/decide/?v=3"),
  // producing a Vercel-native 404 instead of proxying to PostHog. PostHog's own docs and
  // https://github.com/PostHog/posthog/issues/17596 recommend :path(.*) instead.
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
      rewrites: [{ source: '/api/(.*)', destination: 'https://taskmaster-jfw0.onrender.com/api/$1' }],
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

test('pickProxyUrl uses staging API on Vercel preview when env unset', () => {
  const prev = { ...process.env };
  process.env.VERCEL_ENV = 'preview';
  delete process.env.RENDER_API_PROXY_URL;
  delete process.env.VITE_API_URL;
  const { pickProxyUrl, CANONICAL_STAGING_API_URL } = require('./generateVercelConfig.cjs');
  assert.equal(pickProxyUrl(), CANONICAL_STAGING_API_URL);
  process.env = prev;
});

test('pickProxyUrl rejects production API host on preview when only prod env set', () => {
  const prev = { ...process.env };
  process.env.VERCEL_ENV = 'preview';
  process.env.RENDER_API_PROXY_URL = 'https://taskmaster-jfw0.onrender.com';
  delete process.env.VITE_API_URL;
  const { pickProxyUrl, CANONICAL_STAGING_API_URL } = require('./generateVercelConfig.cjs');
  assert.equal(pickProxyUrl(), CANONICAL_STAGING_API_URL);
  process.env = prev;
});

test('buildVercelSecurityHeaders adds preview CSP allowances', () => {
  const { buildContentSecurityPolicy } = require('./vercelSecurityHeaders.cjs');
  const preview = buildContentSecurityPolicy({ isPreview: true });
  assert.ok(preview.includes('https://vercel.live'));
  assert.ok(preview.includes('manifest-src'));
  const prod = buildContentSecurityPolicy({ isPreview: false });
  assert.ok(!prod.includes('https://vercel.live'));
});

test('writeViteProductionEnv forces staging on preview when VITE_API_URL is production', () => {
  const fs = require('fs');
  const path = require('path');
  const prev = { ...process.env };
  const envFile = path.join(__dirname, '../.env.production.local');
  let backup = null;
  try {
    backup = fs.readFileSync(envFile, 'utf8');
  } catch {
    /* no file */
  }

  process.env.VERCEL_ENV = 'preview';
  process.env.VITE_API_URL = 'https://taskmaster-jfw0.onrender.com';

  const { writeViteProductionEnv, CANONICAL_STAGING_API_URL } = require('./generateVercelConfig.cjs');
  writeViteProductionEnv(CANONICAL_STAGING_API_URL);

  const written = fs.readFileSync(envFile, 'utf8');
  assert.ok(written.includes(CANONICAL_STAGING_API_URL));
  assert.ok(!written.includes('taskmaster-jfw0.onrender.com'));

  if (backup === null) {
    fs.unlinkSync(envFile);
  } else {
    fs.writeFileSync(envFile, backup, 'utf8');
  }
  process.env = prev;
});
