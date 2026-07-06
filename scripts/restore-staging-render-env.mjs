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
const STAGING_SERVICE_NAME = 'coreknot-api-staging';
const STAGING_REDIS_NAME = 'taskmaster-redis-staging';
const dryRun = process.argv.includes('--dry-run');

const apiKey = loadRenderApiKey();
if (!apiKey) {
  console.error('RENDER_API_KEY missing');
  process.exit(1);
}

parseEnvFile(path.join(ROOT, 'server', '.env'));
parseEnvFile(path.join(ROOT, 'server', '.env.render'));

async function renderFetch(method, route, body) {
  const res = await fetch(`https://api.render.com/v1${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = text; }
  }
  if (!res.ok) {
    const detail = payload?.message || (typeof payload === 'string' ? payload : JSON.stringify(payload));
    throw new Error(`${method} ${route} → ${res.status}: ${detail}`);
  }
  return payload;
}

async function listServices() {
  const services = [];
  let cursor = null;
  do {
    const q = new URLSearchParams({ limit: '100' });
    if (cursor) q.set('cursor', cursor);
    const page = await renderFetch('GET', `/services?${q}`);
    for (const row of page || []) {
      if (row?.service) services.push(row.service);
    }
    cursor = page?.cursor || null;
  } while (cursor);
  return services;
}

async function resolveStagingRedisUrl() {
  try {
    const rows = await renderFetch('GET', '/key-value?limit=50');
    for (const row of rows || []) {
      const kv = row.keyValue || row.redis || row;
      if (String(kv?.name).toLowerCase() === STAGING_REDIS_NAME.toLowerCase()) {
        if (kv.connectionString) return kv.connectionString;
        if (kv.id) return `redis://${kv.id}:6379`;
      }
    }
  } catch (err) {
    console.warn(`Key-value lookup skipped: ${err.message}`);
  }
  return '';
}

async function resolveStagingServiceId() {
  const services = await listServices();
  const match = services.find(
    (s) => String(s.name).toLowerCase() === STAGING_SERVICE_NAME.toLowerCase(),
  );
  if (!match?.id) {
    throw new Error(`${STAGING_SERVICE_NAME} not found — run npm run staging:create first`);
  }
  return match.id;
}

async function getEnv(serviceId) {
  const rows = await renderFetch('GET', `/services/${serviceId}/env-vars`);
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
  const rows = await renderFetch('PUT', `/services/${serviceId}/env-vars`, body);
  return rows.length;
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

const OMIT_ON_STAGING = new Set(['MONGODB_URI_PROD']);

const mirror = {};
loadEnvFileInto(mirror, path.join(ROOT, 'server', '.env.render'));

const STAGING_ID = await resolveStagingServiceId();
console.log(`Resolved ${STAGING_SERVICE_NAME} → ${STAGING_ID}`);

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

// Prefer staging Redis — never prod REDIS_URL from mirror
const stagingRedis = process.env.REDIS_URL_STAGING?.trim() || await resolveStagingRedisUrl();
if (stagingRedis) {
  merged.REDIS_URL = stagingRedis;
} else if (current.REDIS_URL?.includes('redis-staging') || current.REDIS_URL?.includes('taskmaster-redis-staging') || current.REDIS_URL?.includes('red-')) {
  merged.REDIS_URL = current.REDIS_URL;
} else {
  delete merged.REDIS_URL;
}

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
console.log(`${dryRun ? '[dry-run] ' : ''}Restored ${count} env vars on ${STAGING_SERVICE_NAME}`);
