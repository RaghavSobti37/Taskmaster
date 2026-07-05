#!/usr/bin/env node
/**
 * Pre-deploy smoke: production API — Vercel staging branch uses same DB.
 * Usage: npm run staging:readiness
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const HOSTS_PATH = path.join(ROOT, '.cursor', 'production-hosts.local.json');

const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => console.log(`  ✗ ${msg}`);

const errors = [];
const pushError = (msg) => {
  errors.push(msg);
  fail(msg);
};

const fetchJson = (url, opts = {}) =>
  new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : require('http');
    const req = lib.request(
      url,
      { method: opts.method || 'GET', timeout: 30000, headers: opts.headers || {} },
      (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(body), body });
          } catch {
            resolve({ status: res.statusCode, json: null, body });
          }
        });
      },
    );
    req.on('error', (err) => resolve({ status: 0, error: err.message }));
    if (opts.body) req.write(opts.body);
    req.end();
  });

const readProductionApiUrl = () => {
  if (!fs.existsSync(HOSTS_PATH)) {
    pushError('Missing .cursor/production-hosts.local.json (productionApiUrl)');
    return '';
  }
  try {
    const hosts = JSON.parse(fs.readFileSync(HOSTS_PATH, 'utf8'));
    return String(
      hosts.productionApiUrl || hosts.derived?.renderApiProxyUrl || '',
    ).trim().replace(/\/$/, '');
  } catch (e) {
    pushError(`Invalid production-hosts.local.json: ${e.message}`);
    return '';
  }
};

const checkExpressHealth = async (baseUrl) => {
  const url = `${baseUrl.replace(/\/$/, '')}/api/health`;
  const result = await fetchJson(url);
  const json = result.json;
  if (result.status !== 200 || !json?.ok) {
    pushError(`Production API unhealthy (${url}) → ${result.status || result.error || result.body?.slice?.(0, 80)}`);
    return;
  }
  if (json.status !== 'HEALTHY') {
    pushError(`API status is ${json.status} (expected HEALTHY)`);
    return;
  }
  const mongo = json.dependencies?.mongodb;
  if (mongo?.state !== 'connected') {
    pushError(`MongoDB ${mongo?.state || 'unknown'} (expected connected)`);
    return;
  }
  const sha = json.build?.commitSha;
  if (sha) ok(`Production API healthy (${url}) commit ${sha}`);
  else ok(`Production API healthy (${url})`);
};

const checkSyncProxy = async (baseUrl) => {
  if (!baseUrl || baseUrl.includes('YOUR-')) return;
  const url = `${baseUrl.replace(/\/$/, '')}/api/v1/sync/token`;
  const result = await fetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (result.status === 401) {
    ok(`Sync proxy mounted (${url} → 401 without auth)`);
    return;
  }
  if (result.status === 404) {
    pushError(`Sync proxy missing (${url} → 404)`);
    return;
  }
  pushError(`Sync proxy unexpected (${url} → ${result.status})`);
};

const main = async () => {
  console.log('\nCoreKnot staging readiness (production API / real DB)\n');

  const apiUrl = readProductionApiUrl();
  if (!apiUrl) {
    process.exit(1);
  }

  await checkExpressHealth(apiUrl);
  await checkSyncProxy(apiUrl);

  console.log('');
  if (errors.length) {
    console.log(`Blocking (${errors.length}):`);
    errors.forEach((e) => console.log(`  ✗ ${e}`));
    console.log('\nFix: verify production API on Render; CORS_ALLOW_VERCEL_PREVIEWS=true for Vercel previews.');
    console.log('See docs/operations/STAGING_SETUP.md\n');
    process.exit(1);
  }

  console.log('✓ Staging readiness passed (production API).\n');
  process.exit(0);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
