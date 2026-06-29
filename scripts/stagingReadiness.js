#!/usr/bin/env node
/**
 * Staging smoke gate (migrated setup): Express + Nest health, sync proxy route.
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

const readHosts = () => {
  if (!fs.existsSync(HOSTS_PATH)) {
    pushError('Missing .cursor/production-hosts.local.json');
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(HOSTS_PATH, 'utf8'));
  } catch (e) {
    pushError(`Invalid production-hosts.local.json: ${e.message}`);
    return null;
  }
};

const checkHealth = async (label, baseUrl) => {
  if (!baseUrl || baseUrl.includes('YOUR-')) {
    pushError(`${label}: URL not configured`);
    return;
  }
  const url = `${baseUrl.replace(/\/$/, '')}/api/health`;
  const result = await fetchJson(url);
  if (result.status === 200 && result.json?.ok) {
    ok(`${label} healthy (${url})`);
    return;
  }
  pushError(`${label} unhealthy (${url}) → ${result.status || result.error || result.body?.slice?.(0, 80)}`);
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
    ok(`Express sync proxy mounted (${url} → 401 without auth)`);
    return;
  }
  if (result.status === 404) {
    pushError(`Sync proxy missing on staging (${url} → 404)`);
    return;
  }
  pushError(`Sync proxy unexpected (${url} → ${result.status})`);
};

const main = async () => {
  console.log('\nCoreKnot staging readiness (migrated setup)\n');

  const hosts = readHosts();
  if (!hosts) {
    process.exit(1);
  }

  const stagingApi = hosts.stagingApiUrl || '';
  const stagingNest = hosts.stagingNestApiUrl || '';
  if (!stagingNest || stagingNest.includes('YOUR-')) {
    pushError('stagingNestApiUrl not set in production-hosts.local.json');
  }

  await checkHealth('Express staging API', stagingApi);
  await checkSyncProxy(stagingApi);
  await checkHealth('Nest staging API', stagingNest);

  const serverEnvPath = path.join(ROOT, 'server', '.env');
  if (fs.existsSync(serverEnvPath)) {
    const serverEnv = fs.readFileSync(serverEnvPath, 'utf8');
    if (/^POSTHOG_PROJECT_API_KEY\s*=/m.test(serverEnv)) {
      ok('server/.env has POSTHOG_PROJECT_API_KEY for local/staging server capture');
    } else {
      pushError('server/.env missing POSTHOG_PROJECT_API_KEY');
    }
  }

  console.log('');
  if (errors.length) {
    console.log(`Blocking (${errors.length}):`);
    errors.forEach((e) => console.log(`  ✗ ${e}`));
    console.log('\nFix: deploy coreknot-api-staging + coreknot-nest-staging from `staging` branch on Render.');
    console.log('See docs/STAGING_SETUP.md and .cursor/rules/render-auto-deploy.mdc\n');
    process.exit(1);
  }

  console.log('✓ Staging readiness passed.\n');
  process.exit(0);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
