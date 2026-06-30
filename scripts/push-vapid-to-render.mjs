#!/usr/bin/env node
/**
 * Set VAPID_* on Render WITHOUT wiping other env vars.
 * Uses per-key PUT — never bulk PUT /env-vars (that replaces the entire list).
 *
 * Usage: node scripts/push-vapid-to-render.mjs
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { loadRenderApiKey, parseEnvFile } = require('./loadRenderApiKey.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const SERVICES = [
  { id: 'srv-d37a5m1r0fns739brt40', name: 'CoreKnot-api' },
  { id: 'srv-d8vm9flaeets73d7l6r0', name: 'coreknot-api-staging' },
];

const VAPID_KEYS = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'];

const apiKey = loadRenderApiKey();
if (!apiKey) {
  console.error('RENDER_API_KEY missing — see scripts/loadRenderApiKey.js');
  process.exit(1);
}

parseEnvFile(path.join(ROOT, 'server', '.env'));
parseEnvFile(path.join(ROOT, 'server', '.env.render'));

const vapid = Object.fromEntries(
  VAPID_KEYS.map((k) => [k, (process.env[k] || '').trim()]).filter(([, v]) => v),
);

if (!vapid.VAPID_PUBLIC_KEY || !vapid.VAPID_PRIVATE_KEY) {
  console.error('VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY required in server/.env.render');
  process.exit(1);
}

if (!vapid.VAPID_SUBJECT) {
  vapid.VAPID_SUBJECT = 'mailto:support@coreknot.app';
}

async function upsertEnvVar(serviceId, key, value) {
  const res = await fetch(
    `https://api.render.com/v1/services/${serviceId}/env-vars/${encodeURIComponent(key)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ key, value }),
    },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`PUT ${key} on ${serviceId} → ${res.status}: ${t}`);
  }
  return res.json();
}

for (const svc of SERVICES) {
  for (const [key, value] of Object.entries(vapid)) {
    await upsertEnvVar(svc.id, key, value);
    console.log(`✓ ${svc.name}: ${key}`);
  }
}

console.log('\nVAPID keys set (other env vars untouched). Redeploy API services when ready.');
