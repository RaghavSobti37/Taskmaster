#!/usr/bin/env node
/**
 * Deploy production API (CoreKnot-api / taskmaster) via Render API.
 *
 * Usage:
 *   RENDER_API_KEY=rnd_... node scripts/deploy-production-render.js [--wait] [--clear-cache]
 */
const https = require('https');
const { loadRenderApiKey, renderApiKeyHint } = require('./loadRenderApiKey');

const API_BASE = 'https://api.render.com/v1';
const clearCache = process.argv.includes('--clear-cache');
const shouldWait = process.argv.includes('--wait');

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

function pickProductionApi(services) {
  const byName = services.find((s) => /^coreknot-api$/i.test(String(s.name)));
  if (byName) return byName;

  const bySlug = services.find((s) => String(s.slug || '').toLowerCase().includes('taskmaster')
    && String(s.type || '').includes('web'));
  if (bySlug) return bySlug;

  return services.find((s) => /^taskmaster$/i.test(String(s.name))) || null;
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

async function main() {
  if (!apiKey) {
    console.error(`\n${renderApiKeyHint()}\n`);
    process.exit(1);
  }

  console.log('\n=== Render production API deploy ===\n');
  const services = await listAllServices();
  const svc = pickProductionApi(services);
  if (!svc?.id) {
    console.error('Could not find production API service (CoreKnot-api / taskmaster).');
    process.exit(1);
  }

  const url = svc.serviceDetails?.url || svc.url || 'https://YOUR-PRODUCTION-API.onrender.com';
  console.log(`→ ${svc.name} (${svc.id})`);
  console.log(`  url: ${url}`);

  const deploy = await triggerDeploy(svc.id);
  const deployId = deploy?.id || deploy?.deploy?.id || '?';
  console.log(`  deploy triggered: ${deployId}${clearCache ? ' (cache cleared)' : ''}`);

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
    console.log('\nDone. Poll deploy in Render dashboard or run with --wait\n');
  }
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
});
