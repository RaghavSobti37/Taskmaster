#!/usr/bin/env node

const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const { loadRenderApiKey, renderApiKeyHint, parseEnvFile } = require(path.join(ROOT, 'scripts', 'loadRenderApiKey'));

const PROD_SERVICE_ID = 'srv-d37a5m1r0fns739brt40';
const API_BASE = 'https://api.render.com/v1';

const wantedKeys = [
  'MONGODB_URI_PROD',
  'MONGODB_URI',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
];

async function fetchServiceEnv(serviceId, apiKey) {
  const res = await fetch(`${API_BASE}/services/${serviceId}/env-vars`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Render env fetch failed (${res.status}): ${text}`);
  }
  const rows = await res.json();
  return Object.fromEntries(rows.map((row) => [row.envVar.key, row.envVar.value]));
}

function applyEnv(env) {
  for (const key of wantedKeys) {
    if (env[key]) process.env[key] = env[key];
  }
  if (!process.env.MONGODB_URI && process.env.MONGODB_URI_PROD) {
    process.env.MONGODB_URI = process.env.MONGODB_URI_PROD;
  }
}

function printReport(result) {
  console.log('\n=== Push broadcast summary ===');
  console.log(JSON.stringify({
    ok: result.ok,
    users: result.users,
    devices: result.devices,
    sent: result.sent,
    failed: result.failed,
    notificationId: result.notificationId,
    title: result.title,
    body: result.body,
    error: result.error,
  }, null, 2));

  if (!result.deliveries?.length) {
    console.log('\nNo registered push devices found.');
    return;
  }

  console.log('\n=== Per-device results ===');
  for (const row of result.deliveries) {
    const who = row.email || row.name || row.userId;
    const status = row.status === 'sent'
      ? 'SENT'
      : `FAILED (${row.statusCode || 'n/a'}: ${row.error || 'unknown'})`;
    console.log(`- ${who} | ${row.bucket} | ${status}`);
    console.log(`  ${row.endpoint}`);
  }
}

async function main() {
  parseEnvFile(path.join(ROOT, 'server', '.env'));
  parseEnvFile(path.join(ROOT, 'server', '.env.render'));
  parseEnvFile(path.join(ROOT, '.cursor', 'render-api.local.env'));

  const apiKey = loadRenderApiKey();
  if (apiKey) {
    const env = await fetchServiceEnv(PROD_SERVICE_ID, apiKey);
    applyEnv(env);
    console.log('Loaded production env from Render service', PROD_SERVICE_ID);
  } else if (!process.env.MONGODB_URI && !process.env.MONGODB_URI_PROD) {
    console.error(renderApiKeyHint());
    process.exit(1);
  }

  require('dotenv').config({ path: path.join(ROOT, 'server', '.env') });

  const mongoose = require('mongoose');
  const { broadcastTestPush, configureWebPush } = require('../services/pushNotificationService');

  const uri = (process.env.MONGODB_URI_PROD || process.env.MONGODB_URI || '').trim();
  if (!uri) {
    console.error('MONGODB_URI_PROD / MONGODB_URI missing after env load');
    process.exit(1);
  }

  configureWebPush();
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  console.log('MongoDB connected');

  const result = await broadcastTestPush();
  printReport(result);

  await mongoose.disconnect();
  process.exit(result.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
