#!/usr/bin/env node
/**
 * Set TSC webhook env vars on Render API service and trigger deploy.
 * Usage: RENDER_API_KEY=rnd_... node server/scripts/syncTscIntegrationRender.js
 */
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.render') });

const API_BASE = 'https://api.render.com/v1';
const DEFAULT_SERVICE_HOST = String(process.env.RENDER_API_PROXY_URL || process.env.SERVER_URL || '')
  .trim()
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '') || 'YOUR-RENDER-SERVICE.onrender.com';
const apiKey = (process.env.RENDER_API_KEY || '').trim();
const sharedSecret = (process.env.TSC_WEBHOOK_SHARED_SECRET || process.env.BOOK_CALL_WEBHOOK_SECRET || 'change-me-to-a-long-random-string').trim();

const WEBHOOK_ENV = {
  BOOK_CALL_WEBHOOK_SECRET: sharedSecret,
  ARTIST_ENQUIRY_WEBHOOK_SECRET: sharedSecret,
  ARTIST_PATH_WEBHOOK_SECRET: sharedSecret,
  NEWSLETTER_WEBHOOK_SECRET: sharedSecret,
  MASTERCLASS_REVIEW_WEBHOOK_SECRET: sharedSecret,
  BOOKED_CALLS_CRM_ONLY: 'true',
};

async function renderFetch(method, route, body) {
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
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  if (!response.ok) {
    const detail = payload?.message || text || response.status;
    throw new Error(`${method} ${route} (${response.status}): ${detail}`);
  }
  return payload;
}

async function listServices() {
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
  return services;
}

function pickApiService(services) {
  const host = DEFAULT_SERVICE_HOST.toLowerCase();
  return services.find((s) => String(s.slug || '').toLowerCase().includes('taskmaster'))
    || services.find((s) => String(s.serviceDetails?.url || '').toLowerCase().includes(host))
    || services.find((s) => s.type === 'web_service');
}

async function upsertEnvVar(serviceId, key, value) {
  await renderFetch('PUT', `/services/${serviceId}/env-vars/${encodeURIComponent(key)}`, { key, value });
}

async function main() {
  if (!apiKey) {
    console.error('RENDER_API_KEY required');
    process.exit(1);
  }

  const services = await listServices();
  const apiService = pickApiService(services);
  if (!apiService?.id) {
    console.error('API service not found');
    process.exit(1);
  }

  console.log(`Service: ${apiService.name} (${apiService.id})`);
  for (const [key, value] of Object.entries(WEBHOOK_ENV)) {
    await upsertEnvVar(apiService.id, key, value);
    console.log(`✓ ${key}`);
  }

  const deploy = await renderFetch('POST', `/services/${apiService.id}/deploys`, { clearCache: 'do_not_clear' });
  console.log('✓ Deploy triggered', deploy?.id || '');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
