#!/usr/bin/env node
/**
 * End-to-end production readiness gate.
 * Usage: npm run production:readiness
 * Exit 0 = ready (warnings allowed), 1 = blocking.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const HOSTS_PATH = path.join(ROOT, '.cursor', 'production-hosts.local.json');
const RENDER_ENV_PATH = path.join(ROOT, 'server', '.env.render');

const ok = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.log(`  ⚠ ${msg}`);
const fail = (msg) => console.log(`  ✗ ${msg}`);

const errors = [];
const warnings = [];

const pushError = (msg) => {
  errors.push(msg);
  fail(msg);
};
const pushWarn = (msg) => {
  warnings.push(msg);
  warn(msg);
};

const fetchJson = (url) =>
  new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : require('http');
    lib
      .get(url, { timeout: 15000 }, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, json: null, body });
          }
        });
      })
      .on('error', (err) => resolve({ status: 0, error: err.message }));
  });

const readHosts = () => {
  if (!fs.existsSync(HOSTS_PATH)) {
    pushError('Missing .cursor/production-hosts.local.json — copy from production-hosts.local.example.json');
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(HOSTS_PATH, 'utf8'));
  } catch (e) {
    pushError(`Invalid production-hosts.local.json: ${e.message}`);
    return null;
  }
};

const checkLocalFiles = (hosts) => {
  if (!fs.existsSync(RENDER_ENV_PATH)) {
    pushError('Missing server/.env.render — copy server/.env.render.example and fill from Dashboard');
  } else {
    ok('server/.env.render present (sync vars to Render Dashboard)');
    const renderEnv = fs.readFileSync(RENDER_ENV_PATH, 'utf8');
    if (!/^POSTHOG_PROJECT_API_KEY\s*=/m.test(renderEnv)) {
      pushWarn('server/.env.render missing POSTHOG_PROJECT_API_KEY — set in Render Dashboard for server capture');
    } else {
      ok('server/.env.render documents POSTHOG_PROJECT_API_KEY');
    }
  }

  for (const file of ['vercel.json', 'client/vercel.json']) {
    const raw = fs.readFileSync(path.join(ROOT, file), 'utf8');
    if (raw.includes('YOUR-RENDER-SERVICE')) {
      pushError(`${file} still has YOUR-RENDER-SERVICE placeholder`);
    } else if (!raw.includes('.onrender.com')) {
      pushWarn(`${file} missing onrender.com rewrite — verify Vercel RENDER_API_PROXY_URL`);
    } else {
      ok(`${file} has Render API rewrite`);
    }
  }

  const apiUrl = hosts?.productionApiUrl || '';
  if (apiUrl.includes('YOUR-')) {
    pushError('production-hosts.local.json productionApiUrl not filled');
  } else if (apiUrl) {
    ok(`production API map: ${apiUrl}`);
  }
};

const checkExposure = () => {
  try {
    execSync('node scripts/checkCommittedExposure.js', { cwd: ROOT, stdio: 'pipe' });
    ok('audit:exposure clean');
  } catch (e) {
    pushError('audit:exposure failed — remove secrets/PII from tracked files');
    if (e.stdout) console.log(String(e.stdout));
  }
};

const checkHealth = async (label, url) => {
  if (!url || url.includes('YOUR-')) return;
  const result = await fetchJson(url);
  if (result.status === 200 && result.json?.ok) {
    ok(`${label} healthy (${url})`);
    if (result.json.dependencies?.redis?.ok === false) {
      pushWarn(`${label} Redis unavailable — set REDIS_URL on Render (noeviction policy)`);
    }
    return;
  }
  pushError(`${label} unhealthy (${url}) → ${result.status || result.error || 'bad response'}`);
};

const checkClientBuild = () => {
  try {
    execSync('npm run build --prefix client', {
      cwd: ROOT,
      stdio: 'pipe',
      env: { ...process.env, HUSKY: '0' },
    });
    ok('client production build passes');
  } catch (e) {
    pushError('client production build failed');
    if (e.stderr) console.log(String(e.stderr).slice(-2000));
  }
};

const main = async () => {
  console.log('\nCoreKnot production readiness\n');

  const hosts = readHosts();
  if (hosts) checkLocalFiles(hosts);

  checkExposure();

  if (hosts) {
    await checkHealth('Render API', hosts.productionApiHealthUrl || `${hosts.productionApiUrl}/api/health`);
    const frontendHealth = `${(hosts.productionFrontendUrl || '').replace(/\/$/, '')}/api/health`;
    await checkHealth('Vercel /api proxy', frontendHealth);
  }

  checkClientBuild();

  console.log('');
  if (warnings.length) {
    console.log(`Warnings (${warnings.length}):`);
    warnings.forEach((w) => console.log(`  ⚠ ${w}`));
    console.log('');
  }

  if (errors.length) {
    console.log(`Blocking (${errors.length}):`);
    errors.forEach((e) => console.log(`  ✗ ${e}`));
    console.log('\nSee docs/DEPLOY_ENV.md and docs/ENVIRONMENT_MATRIX.md\n');
    process.exit(1);
  }

  console.log('✓ Production readiness checks passed.\n');
  console.log('Dashboard sync checklist:');
  console.log('  1. Render → CoreKnot-api → paste server/.env.render secrets');
  console.log('  2. Vercel Production → RENDER_API_PROXY_URL + VITE_API_URL = productionApiUrl');
  console.log('  3. Vercel Production → VITE_POSTHOG_PROJECT_TOKEN + VITE_POSTHOG_HOST + VITE_POSTHOG_APP_URL');
  console.log('  4. Render KEEP_WARM_URL cron → productionApiHealthUrl');
  console.log('  5. GitHub → RENDER_DEPLOY_HOOK_API secret for CI deploy\n');
  process.exit(0);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
