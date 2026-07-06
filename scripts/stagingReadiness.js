#!/usr/bin/env node
/**
 * Pre-deploy smoke: staging API + Nest (empty taskmaster_staging DB).
 * Usage: npm run staging:readiness
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const HOSTS_PATH = path.join(ROOT, '.cursor', 'production-hosts.local.json');
const DEFAULT_STAGING_API = 'https://coreknot-api-staging.onrender.com';
const DEFAULT_STAGING_NEST = 'https://coreknot-nest-staging.onrender.com';

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

const readStagingHosts = () => {
  let stagingApiUrl = DEFAULT_STAGING_API;
  let stagingNestApiUrl = DEFAULT_STAGING_NEST;
  if (fs.existsSync(HOSTS_PATH)) {
    try {
      const hosts = JSON.parse(fs.readFileSync(HOSTS_PATH, 'utf8'));
      stagingApiUrl = String(hosts.stagingApiUrl || hosts.derived?.stagingApiUrl || stagingApiUrl)
        .trim().replace(/\/$/, '');
      stagingNestApiUrl = String(hosts.stagingNestApiUrl || hosts.derived?.stagingNestApiUrl || stagingNestApiUrl)
        .trim().replace(/\/$/, '');
    } catch (e) {
      pushError(`Invalid production-hosts.local.json: ${e.message}`);
    }
  } else {
    console.warn('  (no production-hosts.local.json — using default staging URLs)');
  }
  return { stagingApiUrl, stagingNestApiUrl };
};

const checkExpressHealth = async (baseUrl, label, expectTier) => {
  const url = `${baseUrl.replace(/\/$/, '')}/api/health`;
  const result = await fetchJson(url);
  const json = result.json;
  if (result.status !== 200 || !json?.ok) {
    pushError(`${label} unhealthy (${url}) → ${result.status || result.error || result.body?.slice?.(0, 80)}`);
    return;
  }
  if (json.status !== 'HEALTHY') {
    pushError(`${label} status is ${json.status} (expected HEALTHY)`);
    return;
  }
  if (expectTier) {
    const tier = json.build?.deployTier || json.deployTier;
    if (tier && tier !== expectTier) {
      pushError(`${label} deployTier=${tier} (expected ${expectTier})`);
      return;
    }
  }
  const mongo = json.dependencies?.mongodb;
  if (mongo?.state !== 'connected') {
    pushError(`${label} MongoDB ${mongo?.state || 'unknown'} (expected connected)`);
    return;
  }
  const sha = json.build?.commitSha;
  if (sha) ok(`${label} healthy (${url}) commit ${sha}`);
  else ok(`${label} healthy (${url})`);
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
  console.log('\nCoreKnot staging readiness (staging API / taskmaster_staging)\n');

  const { stagingApiUrl, stagingNestApiUrl } = readStagingHosts();
  if (!stagingApiUrl) {
    process.exit(1);
  }

  await checkExpressHealth(stagingApiUrl, 'Staging API', 'staging');
  await checkSyncProxy(stagingApiUrl);
  if (stagingNestApiUrl) {
    await checkExpressHealth(stagingNestApiUrl, 'Staging Nest', 'staging');
  }

  console.log('');
  if (errors.length) {
    console.log(`Blocking (${errors.length}):`);
    errors.forEach((e) => console.log(`  ✗ ${e}`));
    console.log('\nFix: npm run staging:create → restore-staging-render-env.mjs → staging:deploy --wait');
    console.log('See docs/operations/STAGING_SETUP.md\n');
    process.exit(1);
  }

  console.log('✓ Staging readiness passed.\n');
  process.exit(0);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
