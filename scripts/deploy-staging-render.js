#!/usr/bin/env node
/**
 * Option C: deploy staging Express + Nest via Render API, wait, run readiness.
 *
 * Usage:
 *   node scripts/deploy-staging-render.js [--clear-cache] [--wait] [--loop]
 */
const https = require('https');
const { loadRenderApiKey, renderApiKeyHint } = require('./loadRenderApiKey');

const API_BASE = 'https://api.render.com/v1';
const clearCache = process.argv.includes('--clear-cache');
const shouldWait = process.argv.includes('--wait') || process.argv.includes('--loop');
const shouldLoop = process.argv.includes('--loop');

const STAGING_NAMES = ['coreknot-api-staging', 'coreknot-nest-staging'];

const apiKey = loadRenderApiKey();

async function renderFetch(method, route, body) {
  const res = await fetch(`${API_BASE}${route}`, {
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
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = text; }
  }
  if (!res.ok) {
    const detail = payload?.message || (typeof payload === 'string' ? payload : JSON.stringify(payload));
    throw new Error(`${method} ${route} → ${res.status}: ${detail}`);
  }
  return payload;
}

async function listAllServices() {
  const services = [];
  let cursor = null;
  do {
    const query = new URLSearchParams({ limit: '100' });
    if (cursor) query.set('cursor', cursor);
    const page = await renderFetch('GET', `/services?${query}`);
    for (const row of page || []) {
      if (row?.service) services.push(row.service);
    }
    cursor = page?.cursor || null;
  } while (cursor);
  return services;
}

async function triggerDeploy(serviceId) {
  return renderFetch('POST', `/services/${serviceId}/deploys`, {
    clearCache: clearCache ? 'clear' : 'do_not_clear',
  });
}

async function getLatestDeploy(serviceId) {
  const page = await renderFetch('GET', `/services/${serviceId}/deploys?limit=1`);
  const row = Array.isArray(page) ? page[0] : null;
  return row?.deploy || row;
}

async function waitForLive(serviceId, label, maxMs = 900000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const deploy = await getLatestDeploy(serviceId);
    const status = deploy?.status || 'unknown';
    process.stdout.write(`  [${label}] ${deploy?.id || '?'} → ${status}\n`);
    if (status === 'live') return deploy;
    if (['build_failed', 'canceled', 'update_failed', 'pre_deploy_failed'].includes(status)) {
      throw new Error(`${label} deploy failed: ${status}`);
    }
    await new Promise((r) => setTimeout(r, 15000));
  }
  throw new Error(`${label} deploy timed out after ${maxMs / 1000}s`);
}

async function fetchHealth(url) {
  return new Promise((resolve) => {
    https.get(url, { timeout: 30000 }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, body }); }
      });
    }).on('error', (err) => resolve({ status: 0, error: err.message }));
  });
}

async function deployStagingOnce() {
  console.log('\n=== Render staging deploy (Option C) ===\n');

  const services = await listAllServices();
  console.log(`Found ${services.length} Render service(s)\n`);

  const missing = STAGING_NAMES.filter(
    (name) => !services.some((s) => String(s.name).toLowerCase() === name.toLowerCase()),
  );

  if (missing.length) {
    console.error('Missing Render services (404 until these exist):');
    missing.forEach((n) => console.error(`  ✗ ${n}`));
    console.error('\nCreate via Blueprint: Render Dashboard → Blueprints → New Blueprint Instance');
    console.error('  Connect repo → render.yaml → sync');
    console.error('Then re-run: npm run staging:deploy\n');
    process.exit(1);
  }

  for (const name of STAGING_NAMES) {
    const svc = services.find((s) => String(s.name).toLowerCase() === name.toLowerCase());
    const url = svc.serviceDetails?.url || svc.url || '(no url)';
    console.log(`→ ${svc.name} (${svc.id})`);
    console.log(`  url: ${url}`);

    const deploy = await triggerDeploy(svc.id);
    const deployId = deploy?.id || deploy?.deploy?.id || '?';
    console.log(`  deploy triggered: ${deployId}`);

    if (shouldWait) {
      await waitForLive(svc.id, svc.name);
      const healthUrl = `${String(url).replace(/\/$/, '')}/api/health`;
      const h = await fetchHealth(healthUrl);
      if (h.status === 200 && h.json?.ok) {
        console.log(`  ✓ health OK\n`);
      } else {
        console.error(`  ✗ health ${healthUrl} → ${h.status || h.error}\n`);
        process.exit(1);
      }
    } else {
      console.log('');
    }
  }
}

async function runReadiness() {
  const { spawnSync } = require('child_process');
  const result = spawnSync(process.execPath, ['scripts/stagingReadiness.js'], {
    cwd: require('path').join(__dirname, '..'),
    stdio: 'inherit',
  });
  return result.status === 0;
}

async function main() {
  if (!apiKey) {
    console.error(`\n${renderApiKeyHint()}\n`);
    process.exit(1);
  }

  if (shouldLoop) {
    const maxAttempts = 12;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      console.log(`\n--- attempt ${attempt}/${maxAttempts} ---`);
      await deployStagingOnce();
      if (await runReadiness()) {
        console.log('✓ Staging fully green.\n');
        return;
      }
      if (attempt < maxAttempts) {
        console.log('Readiness failed — retry deploy in 60s...\n');
        await new Promise((r) => setTimeout(r, 60000));
      }
    }
    process.exit(1);
  }

  await deployStagingOnce();
  if (shouldWait) {
    const ok = await runReadiness();
    process.exit(ok ? 0 : 1);
  }
  console.log('Done. Run: npm run staging:readiness\n');
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
});
