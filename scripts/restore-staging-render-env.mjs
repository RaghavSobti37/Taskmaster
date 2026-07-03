#!/usr/bin/env node
/**
 * Restore coreknot-api-staging env from server/.env.render (full mirror).
 *
 * Render PUT /env-vars replaces the entire env — never PUT a partial list from GET
 * (sync:false secrets are omitted from GET but required at boot).
 *
 * Usage: node scripts/restore-staging-render-env.mjs [--dry-run]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { loadRenderApiKey, parseEnvFile } = require('./loadRenderApiKey.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const STAGING_ID = 'srv-d8vm9flaeets73d7l6r0';
const dryRun = process.argv.includes('--dry-run');

const apiKey = loadRenderApiKey();
if (!apiKey) {
  console.error('RENDER_API_KEY missing');
  process.exit(1);
}

parseEnvFile(path.join(ROOT, 'server', '.env'));
parseEnvFile(path.join(ROOT, 'server', '.env.render'));

async function getEnv(serviceId) {
  const res = await fetch(`https://api.render.com/v1/services/${serviceId}/env-vars`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GET env ${serviceId} → ${res.status}`);
  const rows = await res.json();
  return Object.fromEntries(rows.map((r) => [r.envVar.key, r.envVar.value]));
}

async function putEnv(serviceId, pairs) {
  const body = Object.entries(pairs)
    .filter(([, v]) => v != null && String(v).trim())
    .map(([key, value]) => ({ key, value: String(value) }));
  if (dryRun) {
    console.log(`[dry-run] Would PUT ${body.length} keys on ${serviceId}`);
    return body.length;
  }
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
    const t = await res.text();
    throw new Error(`PUT env ${serviceId} → ${res.status}: ${t}`);
  }
  return (await res.json()).length;
}

function stripQuotes(v) {
  const s = String(v || '').trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function loadEnvFileInto(target, filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    target[k] = stripQuotes(t.slice(eq + 1));
  }
}

function stagingMongoUri(uri) {
  const raw = String(uri || '').trim();
  if (!raw) return '';
  return raw
    .replace(/\/taskmaster_production(\?|$)/i, '/taskmaster_staging$1')
    .replace(/\/taskmaster_local(\?|$)/i, '/taskmaster_staging$1');
}

const OMIT_ON_STAGING = new Set(['MONGODB_URI_PROD', 'REDIS_URL']);

const mirror = {};
loadEnvFileInto(mirror, path.join(ROOT, 'server', '.env.render'));

let current = {};
try {
  current = await getEnv(STAGING_ID);
  console.log(`Current staging visible keys: ${Object.keys(current).length}`);
} catch (err) {
  console.warn(`Staging GET skipped: ${err.message}`);
}

const merged = { ...mirror, ...current };
for (const [key, value] of Object.entries(mirror)) {
  if (value) merged[key] = value;
}

const stagingUrl = 'https://coreknot-api-staging.onrender.com';
Object.assign(merged, {
  HUSKY: '0',
  NODE_ENV: 'production',
  COREKNOT_DEPLOY_TIER: 'staging',
  DD_SERVICE: 'coreknot-api',
  DD_ENV: 'staging',
  SENTRY_ENVIRONMENT: 'staging',
  CORS_ALLOW_VERCEL_PREVIEWS: 'true',
  SERVER_URL: stagingUrl,
  APP_BASE_URL: stagingUrl,
  TRACKING_BASE_URL: stagingUrl,
  NEST_SYNC_URL: 'https://coreknot-nest-staging.onrender.com',
  SUPABASE_SECONDARY_ENABLED: 'true',
  SUPABASE_PG_MODE: 'rest',
});

merged.MONGODB_URI = stagingMongoUri(
  process.env.MONGODB_URI_STAGING
  || process.env.STAGING_MONGODB_URI
  || merged.MONGODB_URI,
);

for (const key of OMIT_ON_STAGING) {
  delete merged[key];
}

if (!merged.MONGODB_URI?.includes('taskmaster_staging')) {
  console.warn('WARN: MONGODB_URI may not target taskmaster_staging');
}
if (!merged.JWT_SECRET?.trim()) {
  console.error('JWT_SECRET missing from .env.render');
  process.exit(1);
}

const count = await putEnv(STAGING_ID, merged);
console.log(`${dryRun ? '[dry-run] ' : ''}Restored ${count} env vars on coreknot-api-staging`);
