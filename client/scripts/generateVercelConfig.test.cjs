const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SPA_CATCHALL_SOURCE,
  composeRewrites,
  buildPostHogRewrites,
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

  assert.ok(catchallIdx >= 0, 'SPA catch-all present');
  assert.ok(firstPhIdx >= 0, 'PostHog proxy present');
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
