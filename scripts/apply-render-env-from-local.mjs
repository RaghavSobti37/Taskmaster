#!/usr/bin/env node
/**
 * Apply server/.env.render to Render prod + staging API services.
 * Reads ONLY that file (never process.env) to avoid leaking shell vars.
 *
 * Usage: node scripts/apply-render-env-from-local.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { loadRenderApiKey } = require('./loadRenderApiKey.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ENV_FILE = path.join(ROOT, 'server', '.env.render');

const PROD_ID = 'srv-d37a5m1r0fns739brt40';
const STAGING_ID = 'srv-d8vm9flaeets73d7l6r0';

const apiKey = loadRenderApiKey();
if (!apiKey) {
  console.error('RENDER_API_KEY missing — see scripts/loadRenderApiKey.js');
  process.exit(1);
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Missing ${filePath}`);
    process.exit(1);
  }
  const map = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    let value = t.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && value) map[key] = value;
  }
  return map;
}

async function putFullEnv(serviceId, pairs) {
  const body = Object.entries(pairs)
    .filter(([key, value]) => /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(key) && value?.trim())
    .map(([key, value]) => ({ key, value: String(value) }));
  const res = await fetch(`https://api.render.com/v1/services/${serviceId}/env-vars`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${serviceId} → ${res.status}: ${await res.text()}`);
  }
  return (await res.json()).length;
}

async function countEnv(serviceId) {
  const all = [];
  let cursor = null;
  do {
    const q = new URLSearchParams({ limit: '100' });
    if (cursor) q.set('cursor', cursor);
    const res = await fetch(`https://api.render.com/v1/services/${serviceId}/env-vars?${q}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    });
    const page = await res.json();
    for (const row of page || []) all.push(row.envVar?.key);
    cursor = page?.cursor || null;
  } while (cursor);
  return all.length;
}

async function redeploy(serviceId) {
  await fetch(`https://api.render.com/v1/services/${serviceId}/deploys`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ clearCache: 'do_not_clear' }),
  });
}

const prod = readEnvFile(ENV_FILE);
const stagingUrl = 'https://coreknot-api-staging.onrender.com';
const staging = {
  ...prod,
  LOG_LEVEL: 'info',
  DD_ENV: 'staging',
  SENTRY_ENVIRONMENT: 'staging',
  SERVER_URL: stagingUrl,
  APP_BASE_URL: stagingUrl,
  TRACKING_BASE_URL: stagingUrl,
  NEST_SYNC_URL: 'https://coreknot-nest-staging.onrender.com',
};

const prodApplied = await putFullEnv(PROD_ID, prod);
const stagingApplied = await putFullEnv(STAGING_ID, staging);
console.log(`Applied ${prodApplied} keys to prod, ${stagingApplied} to staging`);

const prodCount = await countEnv(PROD_ID);
console.log(`Prod verify: ${prodCount} env vars on Render`);

await redeploy(PROD_ID);
await redeploy(STAGING_ID);
console.log('Redeploys triggered. Check /api/health after boot.');
