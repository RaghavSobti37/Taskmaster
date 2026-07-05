#!/usr/bin/env node
/**
 * Push PostHog + Render log deep-link env vars to Render API services and Vercel project.
 * Uses per-key PUT on Render (never bulk replace). Never prints secret values.
 *
 * Usage: node scripts/push-observability-env.mjs
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { loadRenderApiKey, parseEnvFile } = require('./loadRenderApiKey.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const RENDER_SERVICES = [
  { id: 'srv-d37a5m1r0fns739brt40', name: 'Taskmaster' },
];

const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID || 'prj_eASJORRbLiL9HPDNvkaA7ZNhwhgu';
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || 'team_6ew6oULCB5ybymCVS2BgJyKv';

parseEnvFile(path.join(ROOT, 'server', '.env'));
parseEnvFile(path.join(ROOT, 'server', '.env.render'));
parseEnvFile(path.join(ROOT, '.cursor', 'vercel-token.local.env'));

const posthogToken = (process.env.POSTHOG_PROJECT_API_KEY || process.env.VITE_POSTHOG_PROJECT_TOKEN || '').trim();
if (!posthogToken) {
  console.error('POSTHOG_PROJECT_API_KEY missing in server/.env or server/.env.render');
  process.exit(1);
}

const renderEnv = {
  POSTHOG_PROJECT_API_KEY: posthogToken,
  POSTHOG_HOST: (process.env.POSTHOG_HOST || 'https://us.i.posthog.com').trim(),
};

const vercelEnv = {
  VITE_POSTHOG_PROJECT_TOKEN: posthogToken,
  VITE_POSTHOG_HOST: renderEnv.POSTHOG_HOST,
  VITE_POSTHOG_PROJECT_ID: (process.env.VITE_POSTHOG_PROJECT_ID || '468825').trim(),
  VITE_POSTHOG_APP_URL: (process.env.VITE_POSTHOG_APP_URL || 'https://us.posthog.com/project/468825').trim(),
  VITE_RENDER_SERVICE_ID_PRODUCTION: 'srv-d37a5m1r0fns739brt40',
  VITE_RENDER_SERVICE_ID_STAGING_API: 'srv-d8vm9flaeets73d7l6r0',
  VITE_RENDER_SERVICE_ID_STAGING_NEST: 'srv-d8vm9gbsq97s738h8plg',
};

async function upsertRenderEnv(serviceId, key, value) {
  const res = await fetch(
    `https://api.render.com/v1/services/${serviceId}/env-vars/${encodeURIComponent(key)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${loadRenderApiKey()}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ key, value }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Render ${serviceId} ${key}: ${res.status} ${body.slice(0, 200)}`);
  }
}

async function upsertVercelEnv(key, value, targets = ['production', 'preview', 'development']) {
  const token = (process.env.VERCEL_TOKEN || process.env.VERCEL_ACCESS_TOKEN || '').trim();
  if (!token) return false;

  const listRes = await fetch(
    `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env?teamId=${VERCEL_TEAM_ID}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!listRes.ok) {
    throw new Error(`Vercel list env: ${listRes.status}`);
  }
  const { envs = [] } = await listRes.json();
  const existing = envs.find((e) => e.key === key && e.target?.some((t) => targets.includes(t)));

  const url = existing
    ? `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env/${existing.id}?teamId=${VERCEL_TEAM_ID}`
    : `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env?teamId=${VERCEL_TEAM_ID}`;

  const res = await fetch(url, {
    method: existing ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(
      existing
        ? { value, target: targets, type: 'encrypted' }
        : { key, value, target: targets, type: 'encrypted' },
    ),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vercel ${key}: ${res.status} ${body.slice(0, 200)}`);
  }
  return true;
}

async function main() {
  const renderKey = loadRenderApiKey();
  if (!renderKey) {
    console.error('RENDER_API_KEY missing');
    process.exit(1);
  }

  for (const svc of RENDER_SERVICES) {
    for (const [key, value] of Object.entries(renderEnv)) {
      await upsertRenderEnv(svc.id, key, value);
      console.log(`Render ${svc.name}: set ${key}`);
    }
  }

  let vercelOk = false;
  try {
    for (const [key, value] of Object.entries(vercelEnv)) {
      const ok = await upsertVercelEnv(key, value);
      if (ok) {
        vercelOk = true;
        console.log(`Vercel tsc-coreknot: set ${key}`);
      }
    }
  } catch (err) {
    console.error(`Vercel env update failed: ${err.message}`);
  }

  if (!vercelOk) {
    console.warn('VERCEL_TOKEN not set — skipped Vercel env (add .cursor/vercel-token.local.env or $env:VERCEL_TOKEN)');
  }

  console.log('Observability env push complete.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
