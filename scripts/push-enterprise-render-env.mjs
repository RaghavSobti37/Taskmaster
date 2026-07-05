#!/usr/bin/env node
/**
 * Push enterprise-related env vars to Render (per-key PUT, never bulk replace).
 * Generates CREDENTIAL_ENCRYPTION_KEY locally if missing, then syncs to staging + production API.
 *
 * Usage: node scripts/push-enterprise-render-env.mjs
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { loadRenderApiKey, parseEnvFile } = require('./loadRenderApiKey.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(ROOT, 'server', '.env');

const RENDER_SERVICES = [
  { id: 'srv-d37a5m1r0fns739brt40', name: 'Taskmaster' },
];

function ensureLocalCredentialKey() {
  parseEnvFile(ENV_PATH);
  let key = (process.env.CREDENTIAL_ENCRYPTION_KEY || '').trim();
  if (key) return key;

  key = crypto.randomBytes(32).toString('base64');
  const line = `CREDENTIAL_ENCRYPTION_KEY=${key}`;
  if (fs.existsSync(ENV_PATH)) {
    const raw = fs.readFileSync(ENV_PATH, 'utf8');
    if (/^CREDENTIAL_ENCRYPTION_KEY=/m.test(raw)) {
      fs.writeFileSync(ENV_PATH, raw.replace(/^CREDENTIAL_ENCRYPTION_KEY=.*$/m, line));
    } else {
      fs.writeFileSync(ENV_PATH, `${raw.trimEnd()}\n${line}\n`);
    }
  } else {
    fs.writeFileSync(ENV_PATH, `${line}\n`);
  }
  process.env.CREDENTIAL_ENCRYPTION_KEY = key;
  console.log('Generated CREDENTIAL_ENCRYPTION_KEY in server/.env');
  return key;
}

async function upsertRenderEnv(serviceId, key, value) {
  const apiKey = loadRenderApiKey();
  if (!apiKey) throw new Error('RENDER_API_KEY missing');
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
    const body = await res.text();
    throw new Error(`Render ${serviceId} ${key}: ${res.status} ${body.slice(0, 200)}`);
  }
}

async function main() {
  const credentialKey = ensureLocalCredentialKey();
  const apiKey = loadRenderApiKey();
  if (!apiKey) {
    console.error('RENDER_API_KEY missing — see scripts/loadRenderApiKey.js');
    process.exit(1);
  }

  const envPatch = {
    CREDENTIAL_ENCRYPTION_KEY: credentialKey,
    ENTERPRISE_FEATURES_ENABLED: 'true',
  };

  for (const svc of RENDER_SERVICES) {
    for (const [key, value] of Object.entries(envPatch)) {
      await upsertRenderEnv(svc.id, key, value);
      console.log(`OK ${svc.name}: ${key}`);
    }
  }

  console.log('\nRender env updated. Trigger deploy if services do not auto-restart on env change.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
