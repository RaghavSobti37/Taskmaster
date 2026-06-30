#!/usr/bin/env node
/**
 * Recover CoreKnot-api env vars after accidental bulk PUT wipe.
 *
 * Root cause: bulk PUT /services/{id}/env-vars REPLACES the full env list.
 * push-vapid-to-render.mjs (pre-fix) sent only 3 VAPID keys → deleted everything else.
 *
 * This script gathers env from sibling Render services that were NOT wiped:
 *   - CoreKnot-daily-backup cron (often has MONGODB_URI_PROD, RESEND_API_KEY)
 *   - CoreKnot-subscription-reminders cron
 *   - coreknot-api-staging (if still intact)
 *   - coreknot-nest-staging
 *   - server/.env.render on disk
 *
 * Usage:
 *   node scripts/restore-prod-render-env.mjs           # audit only
 *   node scripts/restore-prod-render-env.mjs --apply     # restore prod + staging API
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { loadRenderApiKey, parseEnvFile } = require('./loadRenderApiKey.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const PROD_ID = 'srv-d37a5m1r0fns739brt40';
const STAGING_ID = 'srv-d8vm9flaeets73d7l6r0';

const SOURCE_NAMES = [
  'CoreKnot-daily-backup',
  'CoreKnot-subscription-reminders',
  'coreknot-api-staging',
  'coreknot-nest-staging',
];

const PROD_DEFAULTS = {
  HUSKY: '0',
  NODE_ENV: 'production',
  LOG_LEVEL: 'warn',
  SUPABASE_SECONDARY_ENABLED: 'true',
  SUPABASE_PG_MODE: 'rest',
  SUPABASE_BACKUP_BUCKET: 'taskmaster-backups',
  SERVER_URL: 'https://taskmaster-jfw0.onrender.com',
  APP_BASE_URL: 'https://taskmaster-jfw0.onrender.com',
  TRACKING_BASE_URL: 'https://taskmaster-jfw0.onrender.com',
  FRONTEND_URL: 'https://tsccoreknot.com',
  CLIENT_URL: 'https://tsccoreknot.com',
  DD_SERVICE: 'coreknot-api',
  DD_ENV: 'production',
  SENTRY_ENVIRONMENT: 'production',
};

const apply = process.argv.includes('--apply');
const apiKey = loadRenderApiKey();

if (!apiKey) {
  console.error('RENDER_API_KEY missing — see scripts/loadRenderApiKey.js');
  process.exit(1);
}

parseEnvFile(path.join(ROOT, 'server', '.env'));
parseEnvFile(path.join(ROOT, 'server', '.env.render'));

async function renderFetch(route, options = {}) {
  const res = await fetch(`https://api.render.com/v1${route}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...options,
  });
  const text = await res.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = text; }
  }
  if (!res.ok) {
    throw new Error(`${options.method || 'GET'} ${route} → ${res.status}: ${payload?.message || text}`);
  }
  return payload;
}

async function listServices() {
  const services = [];
  let cursor = null;
  do {
    const q = new URLSearchParams({ limit: '100' });
    if (cursor) q.set('cursor', cursor);
    const page = await renderFetch(`/services?${q}`);
    for (const row of page || []) {
      if (row?.service) services.push(row.service);
    }
    cursor = page?.cursor || null;
  } while (cursor);
  return services;
}

async function getEnvMap(serviceId) {
  const rows = await renderFetch(`/services/${serviceId}/env-vars`);
  return Object.fromEntries(rows.map((r) => [r.envVar.key, r.envVar.value]));
}

async function listRecentDeploys(serviceId, limit = 5) {
  const rows = await renderFetch(`/services/${serviceId}/deploys?limit=${limit}`);
  return (rows || []).map((r) => r.deploy).filter(Boolean);
}

function mergeEnv(target, source, label) {
  let added = 0;
  for (const [key, value] of Object.entries(source || {})) {
    if (!value || !String(value).trim()) continue;
    if (!target[key]) {
      target[key] = String(value).trim();
      added += 1;
    }
  }
  return { added, label };
}

function readLocalRenderEnv() {
  const file = path.join(ROOT, 'server', '.env.render');
  if (!fs.existsSync(file)) return {};
  const map = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (v) map[k] = v;
  }
  return map;
}

async function putFullEnv(serviceId, pairs) {
  const body = Object.entries(pairs)
    .filter(([, v]) => v != null && String(v).trim())
    .map(([key, value]) => ({ key, value: String(value) }));
  return renderFetch(`/services/${serviceId}/env-vars`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

const services = await listServices();
const byName = Object.fromEntries(services.map((s) => [s.name, s]));

console.log('\n=== CoreKnot Render env recovery audit ===\n');

const prodEnv = await getEnvMap(PROD_ID);
const prodKeys = Object.keys(prodEnv);
console.log(`CoreKnot-api (${PROD_ID}): ${prodKeys.length} env var(s)`);
if (prodKeys.length) console.log(`  keys: ${prodKeys.sort().join(', ')}`);

const deploys = await listRecentDeploys(PROD_ID, 8);
if (deploys.length) {
  console.log('\nRecent prod deploys:');
  for (const d of deploys) {
    console.log(`  ${d.createdAt}  ${d.status}  ${d.commit?.message?.slice(0, 60) || d.id}`);
  }
}

const recovered = { ...PROD_DEFAULTS };
const sources = [];

for (const name of [...new Set(SOURCE_NAMES)]) {
  const svc = byName[name];
  if (!svc) {
    console.log(`\n⚠ Source not found: ${name}`);
    continue;
  }
  const env = await getEnvMap(svc.id);
  const count = Object.keys(env).length;
  console.log(`\nSource ${name} (${svc.id}): ${count} env var(s)`);
  if (count <= 5) {
    console.log(`  keys: ${Object.keys(env).sort().join(', ') || '(empty)'}`);
  }
  const { added } = mergeEnv(recovered, env, name);
  sources.push({ name, count, added });
}

const local = readLocalRenderEnv();
const { added: localAdded } = mergeEnv(recovered, local, 'server/.env.render');
sources.push({ name: 'server/.env.render', count: Object.keys(local).length, added: localAdded });

const recoveredKeys = Object.keys(recovered).sort();
const critical = [
  'MONGODB_URI_PROD', 'MONGODB_URI', 'JWT_SECRET', 'ENCRYPTION_KEY',
  'REDIS_URL', 'RESEND_API_KEY', 'GOOGLE_CLIENT_SECRET', 'SUPABASE_URL',
];
const missingCritical = critical.filter((k) => !recovered[k]);

console.log(`\n--- Recovery merge ---`);
console.log(`Recovered ${recoveredKeys.length} unique keys from sources + defaults`);
for (const s of sources) {
  console.log(`  ${s.name}: ${s.count} keys, +${s.added} new`);
}
console.log(`\nCritical still missing (${missingCritical.length}):`);
console.log(missingCritical.length ? `  ${missingCritical.join(', ')}` : '  (none — ready to apply)');

if (!apply) {
  console.log('\nDry run only. To restore prod + staging API env:');
  console.log('  node scripts/restore-prod-render-env.mjs --apply\n');
  console.log('Also check your LOCAL machine for an older server/.env.render backup.');
  console.log('MongoDB/Supabase DATA is unaffected — only Render env config was wiped.\n');
  process.exit(missingCritical.length ? 1 : 0);
}

if (missingCritical.length) {
  console.error('\nRefusing --apply while critical keys missing. Fill gaps first.\n');
  process.exit(1);
}

const stagingUrl = 'https://coreknot-api-staging.onrender.com';
const stagingPayload = {
  ...recovered,
  LOG_LEVEL: 'info',
  DD_ENV: 'staging',
  SENTRY_ENVIRONMENT: 'staging',
  SERVER_URL: stagingUrl,
  APP_BASE_URL: stagingUrl,
  TRACKING_BASE_URL: stagingUrl,
  NEST_SYNC_URL: 'https://coreknot-nest-staging.onrender.com',
};

await putFullEnv(PROD_ID, recovered);
console.log(`\n✓ Restored ${recoveredKeys.length} keys on CoreKnot-api`);

await putFullEnv(STAGING_ID, stagingPayload);
console.log(`✓ Restored staging API env`);

await renderFetch(`/services/${PROD_ID}/deploys`, {
  method: 'POST',
  body: JSON.stringify({ clearCache: 'do_not_clear' }),
});
console.log('✓ Prod redeploy triggered');

console.log('\nDone. Verify /api/health after deploy completes.\n');
