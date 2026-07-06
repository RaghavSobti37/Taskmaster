#!/usr/bin/env node
/** Patch Nest staging DATABASE_URL from server SUPABASE_DB_URL + redeploy. */
const path = require('path');
const fs = require('fs');
const { loadRenderApiKey, parseEnvFile } = require('./loadRenderApiKey');

const ROOT = path.join(__dirname, '..');
const NEST_SERVICE_NAME = 'coreknot-nest-staging';
const HOSTS_PATH = path.join(ROOT, '.cursor', 'production-hosts.local.json');
const apiKey = loadRenderApiKey();

parseEnvFile(path.join(ROOT, 'server', '.env'));
parseEnvFile(path.join(ROOT, 'server', '.env.render'));

function readPreviewDatabaseUrl() {
  if (!fs.existsSync(HOSTS_PATH)) return '';
  try {
    const hosts = JSON.parse(fs.readFileSync(HOSTS_PATH, 'utf8'));
    return String(hosts.supabase?.preview?.databaseUrl || '').trim();
  } catch {
    return '';
  }
}

let dbUrl = readPreviewDatabaseUrl()
  || (process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '').trim();
if (!dbUrl || dbUrl.includes('localhost')) {
  console.error('Need SUPABASE_DB_URL in server/.env.render for Nest staging Postgres');
  process.exit(1);
}

if (!/[?&]sslmode=/.test(dbUrl)) {
  dbUrl += dbUrl.includes('?') ? '&sslmode=require' : '?sslmode=require';
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

async function resolveNestServiceId() {
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
  const match = services.find((s) => String(s.name).toLowerCase() === NEST_SERVICE_NAME);
  if (!match?.id) throw new Error(`${NEST_SERVICE_NAME} not found`);
  return match.id;
}

async function main() {
  if (!apiKey) process.exit(1);
  const nestId = await resolveNestServiceId();
  console.log(`Resolved ${NEST_SERVICE_NAME} → ${nestId}`);
  await renderFetch('PUT', `/services/${nestId}/env-vars/${encodeURIComponent('DATABASE_URL')}`, {
    key: 'DATABASE_URL',
    value: dbUrl,
  });
  console.log('✓ DATABASE_URL updated on coreknot-nest-staging');
  await renderFetch('POST', `/services/${nestId}/deploys`, { clearCache: 'do_not_clear' });
  console.log('✓ Redeploy triggered');
}

main().catch((e) => { console.error(e.message); process.exit(1); });