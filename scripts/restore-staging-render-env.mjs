#!/usr/bin/env node
/**
 * Restore coreknot-api-staging env vars from prod service + local .env.render.
 * Usage: node scripts/restore-staging-render-env.mjs
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
const PROD_ID = 'srv-d37a5m1r0fns739brt40';

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

const base = {};
try {
  Object.assign(base, await getEnv(PROD_ID));
  console.log(`Loaded ${Object.keys(base).length} keys from prod reference service`);
} catch (err) {
  console.warn(`Prod env fetch skipped: ${err.message}`);
}

const renderEnvPath = path.join(ROOT, 'server', '.env.render');
for (const line of fs.readFileSync(renderEnvPath, 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq < 0) continue;
  const k = t.slice(0, eq).trim();
  if (!base[k]) base[k] = stripQuotes(t.slice(eq + 1));
}

const stagingUrl = 'https://coreknot-api-staging.onrender.com';
Object.assign(base, {
  HUSKY: '0',
  NODE_ENV: 'production',
  DD_SERVICE: 'coreknot-api',
  DD_ENV: 'staging',
  SENTRY_ENVIRONMENT: 'staging',
  SERVER_URL: stagingUrl,
  APP_BASE_URL: stagingUrl,
  TRACKING_BASE_URL: stagingUrl,
  NEST_SYNC_URL: 'https://coreknot-nest-staging.onrender.com',
  SUPABASE_SECONDARY_ENABLED: 'true',
  SUPABASE_PG_MODE: 'rest',
  UPLOADTHING_SECRET: stripQuotes(process.env.UPLOADTHING_SECRET || base.UPLOADTHING_SECRET),
  UPLOADTHING_TOKEN: stripQuotes(process.env.UPLOADTHING_TOKEN || base.UPLOADTHING_TOKEN),
});

const count = await putEnv(STAGING_ID, base);
console.log(`Restored ${count} env vars on coreknot-api-staging`);
