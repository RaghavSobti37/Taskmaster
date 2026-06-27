#!/usr/bin/env node
/**
 * Create coreknot-api-staging + coreknot-nest-staging on Render if missing.
 * Requires RENDER_API_KEY (see loadRenderApiKey.js).
 */
const { loadRenderApiKey, renderApiKeyHint, parseEnvFile } = require('./loadRenderApiKey');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const API_BASE = 'https://api.render.com/v1';
const OWNER_ID = process.env.RENDER_OWNER_ID || 'tea-d0tk3be3jp1c73empij0';
const REF_SERVICE = process.env.RENDER_REF_SERVICE_ID || 'srv-d37a5m1r0fns739brt40';

const apiKey = loadRenderApiKey();

function readEnvMap() {
  const map = {};
  for (const rel of ['server/.env', 'server/.env.render', 'nestjs-server/.env']) {
    parseEnvFile(path.join(ROOT, rel));
  }
  for (const key of Object.keys(process.env)) {
    if (['MONGODB_URI', 'JWT_SECRET', 'ENCRYPTION_KEY', 'REDIS_URL', 'DATABASE_URL', 'SUPABASE_DB_URL', 'FRONTEND_URL'].includes(key)) {
      map[key] = process.env[key];
    }
  }
  return map;
}

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

async function getRefService() {
  const data = await renderFetch('GET', `/services/${REF_SERVICE}`);
  return data.service || data;
}

function envList(pairs) {
  return Object.entries(pairs)
    .filter(([, v]) => v != null && String(v).trim())
    .map(([key, value]) => ({ key, value: String(value) }));
}

async function createWebService(spec) {
  const payload = await renderFetch('POST', '/services', spec);
  return payload.service || payload;
}

async function main() {
  if (!apiKey) {
    console.error(`\n${renderApiKeyHint()}\n`);
    process.exit(1);
  }

  const ref = await getRefService();
  const region = ref.serviceDetails?.region || 'singapore';
  const repo = ref.repo;
  if (!repo) {
    console.error('Could not resolve repo URL from reference Render service');
    process.exit(1);
  }
  const env = readEnvMap();
  const existing = await listServices();
  const names = existing.map((s) => String(s.name).toLowerCase());

  const created = [];

  if (!names.includes('coreknot-api-staging')) {
    console.log('Creating coreknot-api-staging...');
    const svc = await createWebService({
      type: 'web_service',
      name: 'coreknot-api-staging',
      ownerId: OWNER_ID,
      repo,
      branch: 'staging',
      autoDeploy: 'yes',
      rootDir: 'server',
      envVars: envList({
        HUSKY: '0',
        NODE_ENV: 'production',
        DD_SERVICE: 'coreknot-api',
        DD_ENV: 'staging',
        SENTRY_ENVIRONMENT: 'staging',
        MONGODB_URI: env.MONGODB_URI,
        JWT_SECRET: env.JWT_SECRET,
        ENCRYPTION_KEY: env.ENCRYPTION_KEY,
        REDIS_URL: env.REDIS_URL,
        NEST_SYNC_URL: 'https://coreknot-nest-staging.onrender.com',
        SUPABASE_SECONDARY_ENABLED: 'true',
        SUPABASE_PG_MODE: 'rest',
      }),
      serviceDetails: {
        env: 'node',
        region,
        plan: 'free',
        healthCheckPath: '/api/health',
        envSpecificDetails: {
          buildCommand: 'cd .. && bash scripts/render-build.sh api',
          startCommand: 'npm start',
        },
      },
    });
    created.push(svc);
    console.log(`  ✓ ${svc.id} → ${svc.serviceDetails?.url || svc.url}`);
  } else {
    console.log('✓ coreknot-api-staging already exists');
  }

  if (!names.includes('coreknot-nest-staging')) {
    console.log('Creating coreknot-nest-staging...');
    const svc = await createWebService({
      type: 'web_service',
      name: 'coreknot-nest-staging',
      ownerId: OWNER_ID,
      repo,
      branch: 'staging',
      autoDeploy: 'yes',
      rootDir: 'nestjs-server',
      envVars: envList({
        HUSKY: '0',
        NODE_ENV: 'production',
        PORT: '5001',
        DD_SERVICE: 'coreknot-nest-api',
        DD_ENV: 'staging',
        SENTRY_ENVIRONMENT: 'staging',
        DATABASE_URL: env.SUPABASE_DB_URL || env.DATABASE_URL,
        JWT_SECRET: env.JWT_SECRET,
        REDIS_URL: env.REDIS_URL,
        FRONTEND_URL: env.FRONTEND_URL || 'https://taskmaster-sand.vercel.app',
      }),
      serviceDetails: {
        env: 'node',
        region,
        plan: 'free',
        healthCheckPath: '/api/health',
        envSpecificDetails: {
          buildCommand: 'cd .. && bash scripts/render-build.sh nest',
          startCommand: 'npm run start:prod',
        },
      },
    });
    created.push(svc);
    console.log(`  ✓ ${svc.id} → ${svc.serviceDetails?.url || svc.url}`);
  } else {
    console.log('✓ coreknot-nest-staging already exists');
  }

  if (created.length) {
    console.log('\nServices created — first deploy may take 10–15 min.');
    console.log('Run: npm run staging:deploy\n');
  } else {
    console.log('\nNothing to create.\n');
  }
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
});
