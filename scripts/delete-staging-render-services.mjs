#!/usr/bin/env node
/**
 * Delete Render staging/temp services — Vercel staging branch uses production API.
 *
 * Usage:
 *   node scripts/delete-staging-render-services.mjs           # dry-run
 *   node scripts/delete-staging-render-services.mjs --apply   # delete + enable preview CORS on prod API
 */
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { loadRenderApiKey } = require('./loadRenderApiKey.js');

const DELETE_NAMES = new Set([
  'coreknot-api-staging',
  'coreknot-nest-staging',
  'taskmaster-redis-staging',
]);

/** Known IDs (fallback if list API paginates oddly). */
const KNOWN_STAGING_IDS = [
  'srv-d8vm9flaeets73d7l6r0',
  'srv-d8vm9gbsq97s738h8plg',
];

const PROD_API_NAMES = new Set(['CoreKnot-api', 'coreknot-api', 'Taskmaster']);

const apply = process.argv.includes('--apply');

async function renderFetch(apiKey, method, path, body) {
  const res = await fetch(`https://api.render.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return json;
}

async function listAllServices(apiKey) {
  const out = [];
  let cursor = '';
  for (;;) {
    const q = cursor ? `?limit=100&cursor=${encodeURIComponent(cursor)}` : '?limit=100';
    const page = await renderFetch(apiKey, 'GET', `/services${q}`);
    for (const row of page || []) {
      const svc = row.service || row;
      if (svc?.id) out.push(svc);
    }
    cursor = page?.cursor || '';
    if (!cursor) break;
  }
  return out;
}

async function upsertEnv(apiKey, serviceId, key, value) {
  await renderFetch(apiKey, 'PUT', `/services/${serviceId}/env-vars/${encodeURIComponent(key)}`, {
    key,
    value,
  });
}

async function main() {
  const apiKey = loadRenderApiKey();
  if (!apiKey) {
    console.error('RENDER_API_KEY missing');
    process.exit(1);
  }

  const services = await listAllServices(apiKey);
  const byName = new Map(services.map((s) => [s.name, s]));

  const toDelete = services.filter((s) => DELETE_NAMES.has(s.name));
  for (const id of KNOWN_STAGING_IDS) {
    if (!toDelete.some((s) => s.id === id)) {
      const match = services.find((s) => s.id === id);
      if (match) toDelete.push(match);
    }
  }

  const prodApi = services.find((s) => PROD_API_NAMES.has(s.name));
  if (!prodApi) {
    console.warn('Production API service not found by name — CORS patch skipped');
  }

  console.log(`\nRender staging cleanup (${apply ? 'APPLY' : 'dry-run'})\n`);

  if (!toDelete.length) {
    console.log('No staging services found to delete.');
  } else {
    for (const svc of toDelete) {
      console.log(`${apply ? 'DELETE' : 'would delete'}: ${svc.name} (${svc.id})`);
      if (apply) {
        await renderFetch(apiKey, 'DELETE', `/services/${svc.id}`);
        console.log(`  ✓ deleted ${svc.name}`);
      }
    }
  }

  if (prodApi) {
    console.log(`\n${apply ? 'Set' : 'Would set'} CORS_ALLOW_VERCEL_PREVIEWS=true on ${prodApi.name} (${prodApi.id})`);
    if (apply) {
      await upsertEnv(apiKey, prodApi.id, 'CORS_ALLOW_VERCEL_PREVIEWS', 'true');
      console.log('  ✓ preview CORS enabled on production API');
    }
  }

  console.log('\nVercel Preview should use productionApiUrl from .cursor/production-hosts.local.json');
  console.log('  VITE_API_URL=<productionApiUrl>');
  console.log('  RENDER_API_PROXY_URL=<productionApiUrl>\n');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
