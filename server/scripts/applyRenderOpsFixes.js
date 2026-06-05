#!/usr/bin/env node
/**
 * Apply production ops fixes on Render:
 *   1. ENCRYPTION_KEY on the API web service
 *   2. Key Value / Redis maxmemoryPolicy → noeviction (BullMQ-safe)
 *
 * Usage:
 *   RENDER_API_KEY=rnd_... node server/scripts/applyRenderOpsFixes.js
 *   RENDER_API_KEY=rnd_... node server/scripts/applyRenderOpsFixes.js --deploy
 *   RENDER_API_KEY=rnd_... node server/scripts/applyRenderOpsFixes.js --redis-only
 *
 * Reads ENCRYPTION_KEY from server/.env.render when not already set in the environment.
 */
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.render') });

const API_BASE = 'https://api.render.com/v1';
const DEFAULT_SERVICE_HOST = 'YOUR-RENDER-SERVICE.onrender.com';

const apiKey = (process.env.RENDER_API_KEY || '').trim();
const shouldDeploy = process.argv.includes('--deploy');
const redisOnly = process.argv.includes('--redis-only');

function parseEnvValue(line) {
  const idx = line.indexOf('=');
  if (idx < 0) return '';
  let value = line.slice(idx + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value;
}

function readEncryptionKeyFromRenderEnv() {
  const renderEnvPath = path.join(__dirname, '..', '.env.render');
  if (!fs.existsSync(renderEnvPath)) return '';
  const raw = fs.readFileSync(renderEnvPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith('ENCRYPTION_KEY=')) {
      return parseEnvValue(line);
    }
  }
  return '';
}

function redisHostFromUrl(redisUrl) {
  if (!redisUrl) return '';
  const match = String(redisUrl).match(/red-[a-z0-9]+/i);
  return match ? match[0] : '';
}

async function renderFetch(method, route, body, { allowNotFound = false } = {}) {
  const response = await fetch(`${API_BASE}${route}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    if (allowNotFound && response.status === 404) {
      return null;
    }
    const detail =
      typeof payload === 'object' && payload?.message
        ? payload.message
        : typeof payload === 'string'
          ? payload
          : JSON.stringify(payload);
    throw new Error(`${method} ${route} failed (${response.status}): ${detail}`);
  }

  return payload;
}

async function listPaginated(route, resourceKey) {
  const items = [];
  let cursor = null;

  do {
    const query = new URLSearchParams({ limit: '100' });
    if (cursor) query.set('cursor', cursor);
    const page = await renderFetch('GET', `${route}?${query.toString()}`);
    const rows = Array.isArray(page) ? page : [];
    for (const row of rows) {
      const resource = row?.[resourceKey] || row;
      if (resource?.id) items.push(resource);
    }
    cursor = page?.cursor || null;
  } while (cursor);

  return items;
}

async function listAllServices() {
  const services = [];
  let cursor = null;

  do {
    const query = new URLSearchParams({ limit: '100' });
    if (cursor) query.set('cursor', cursor);
    const page = await renderFetch('GET', `/services?${query.toString()}`);
    const rows = Array.isArray(page) ? page : [];
    for (const row of rows) {
      if (row?.service) services.push(row.service);
    }
    cursor = page?.cursor || null;
  } while (cursor);

  return services;
}

function pickApiService(services) {
  const host = (process.env.RENDER_SERVICE_HOST || DEFAULT_SERVICE_HOST).toLowerCase();
  const bySlug = services.find((svc) => String(svc.slug || '').toLowerCase().includes('taskmaster'));
  if (bySlug) return bySlug;

  const byUrl = services.find((svc) => {
    const url = String(svc.serviceDetails?.url || svc.url || '').toLowerCase();
    return url.includes(host);
  });
  if (byUrl) return byUrl;

  const webServices = services.filter((svc) => svc.type === 'web_service' || svc.type === 'private_service');
  if (webServices.length === 1) return webServices[0];

  return null;
}

async function getConnectionInfo(kind, id) {
  const route = kind === 'redis' ? `/redis/${id}/connection-info` : `/key-value/${id}/connection-info`;
  return renderFetch('GET', route);
}

function connectionMatchesHost(connectionInfo, redisHost) {
  const haystack = [
    connectionInfo?.internalConnectionString,
    connectionInfo?.externalConnectionString,
    connectionInfo?.redisCLICommand,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(String(redisHost).toLowerCase());
}

async function resolveRedisInstance(redisHost) {
  const candidates = [
    ...(await listPaginated('/redis', 'redis')).map((instance) => ({ kind: 'redis', instance })),
    ...(await listPaginated('/key-value', 'keyValue')).map((instance) => ({ kind: 'key-value', instance })),
  ];

  for (const { kind, instance } of candidates) {
    const info = await getConnectionInfo(kind, instance.id);
    if (connectionMatchesHost(info, redisHost)) {
      return { kind, instance, connectionInfo: info };
    }
  }

  const explicitId = (process.env.RENDER_KEY_VALUE_ID || '').trim();
  if (explicitId) {
    for (const kind of ['redis', 'key-value']) {
      const info = await getConnectionInfo(kind, explicitId);
      if (info) {
        return { kind, instance: { id: explicitId, name: explicitId }, connectionInfo: info };
      }
    }
  }

  return null;
}

async function upsertEnvVar(serviceId, key, value) {
  return renderFetch('PUT', `/services/${serviceId}/env-vars/${encodeURIComponent(key)}`, {
    key,
    value,
  });
}

async function updateMaxmemoryPolicy(kind, instanceId) {
  const route = kind === 'redis' ? `/redis/${instanceId}` : `/key-value/${instanceId}`;
  return renderFetch('PATCH', route, {
    maxmemoryPolicy: 'noeviction',
  });
}

async function triggerDeploy(serviceId) {
  return renderFetch('POST', `/services/${serviceId}/deploys`, { clearCache: 'do_not_clear' });
}

async function main() {
  if (!apiKey) {
    console.error('\nRENDER_API_KEY is required.');
    console.error('Create one: Render Dashboard → Account Settings → API Keys');
    console.error('Then run:');
    console.error('  $env:RENDER_API_KEY="rnd_..."; node server/scripts/applyRenderOpsFixes.js --deploy\n');
    process.exit(1);
  }

  const encryptionKey = (process.env.ENCRYPTION_KEY || readEncryptionKeyFromRenderEnv()).trim();
  if (!redisOnly && !/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
    console.error('ENCRYPTION_KEY must be a 64-character hex string (set in server/.env.render).');
    process.exit(1);
  }

  const redisHost =
    redisHostFromUrl(process.env.REDIS_URL) ||
    process.env.RENDER_REDIS_HOST ||
    'red-d867phojo89c73862j9g';

  console.log('\nCoreKnot Render ops fixes\n');

  let apiService = null;
  if (!redisOnly) {
    const services = await listAllServices();
    apiService = pickApiService(services);
    if (!apiService?.id) {
      console.error('Could not find API web service. Set RENDER_SERVICE_HOST or check API key workspace.');
      process.exit(1);
    }

    console.log(`API service: ${apiService.name} (${apiService.id})`);
    await upsertEnvVar(apiService.id, 'ENCRYPTION_KEY', encryptionKey);
    console.log('✓ ENCRYPTION_KEY set on Render service');
  }

  console.log(`Resolving Redis host: ${redisHost}`);
  const resolved = await resolveRedisInstance(redisHost);
  if (!resolved) {
    console.error(`Could not find Redis/Key Value instance for host ${redisHost}.`);
    console.error('Set RENDER_KEY_VALUE_ID to the srv-... id from the Render dashboard URL.');
    process.exit(1);
  }

  const { kind, instance, connectionInfo } = resolved;
  const currentPolicy = instance.options?.maxmemoryPolicy || '(unknown)';
  console.log(`Redis instance: ${instance.name} (${instance.id}) [${kind}]`);
  console.log(`Current policy: ${currentPolicy}`);
  console.log(`Internal URL: ${connectionInfo.internalConnectionString}`);

  await updateMaxmemoryPolicy(kind, instance.id);
  console.log('✓ maxmemoryPolicy → noeviction');

  if (shouldDeploy && apiService?.id) {
    await triggerDeploy(apiService.id);
    console.log('✓ Deploy triggered (pick up ENCRYPTION_KEY on next boot)');
  } else if (!redisOnly) {
    console.log('ℹ Skipped deploy — run with --deploy to restart the API service');
  } else {
    console.log('ℹ Redis-only mode — no API redeploy needed');
  }

  console.log('\nDone.\n');
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
});
