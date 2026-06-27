#!/usr/bin/env node
/** Patch Nest staging DATABASE_URL from server SUPABASE_DB_URL + redeploy. */
const path = require('path');
const { loadRenderApiKey, parseEnvFile } = require('./loadRenderApiKey');

const ROOT = path.join(__dirname, '..');
const NEST_SERVICE_ID = 'srv-d8vm9gbsq97s738h8plg';
const apiKey = loadRenderApiKey();

parseEnvFile(path.join(ROOT, 'server', '.env'));
const dbUrl = (process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '').trim();
if (!dbUrl || dbUrl.includes('localhost')) {
  console.error('Need SUPABASE_DB_URL in server/.env for Nest staging Postgres');
  process.exit(1);
}

async function renderFetch(method, route, body) {
  const res = await fetch(`https://api.render.com/v1${route}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let payload = null;
  if (text) try { payload = JSON.parse(text); } catch { payload = text; }
  if (!res.ok) throw new Error(`${method} ${route} → ${res.status}: ${payload?.message || text}`);
  return payload;
}

async function main() {
  if (!apiKey) process.exit(1);
  await renderFetch('PUT', `/services/${NEST_SERVICE_ID}/env-vars/${encodeURIComponent('DATABASE_URL')}`, {
    key: 'DATABASE_URL',
    value: dbUrl,
  });
  console.log('✓ DATABASE_URL updated on coreknot-nest-staging');
  await renderFetch('POST', `/services/${NEST_SERVICE_ID}/deploys`, { clearCache: 'clear' });
  console.log('✓ Redeploy triggered');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
