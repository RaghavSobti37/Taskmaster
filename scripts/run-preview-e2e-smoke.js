#!/usr/bin/env node
/**
 * E2E smoke against Vercel Preview + staging API.
 * Requires E2E_BASE_URL (preview deployment) and staging API from production-hosts.
 *
 * Usage:
 *   node scripts/run-preview-e2e-smoke.js
 *   E2E_BASE_URL=https://xxx.vercel.app node scripts/run-preview-e2e-smoke.js
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const HOSTS_PATH = path.join(ROOT, '.cursor/production-hosts.local.json');

function loadStagingApi() {
  if (process.env.E2E_API_URL) return process.env.E2E_API_URL;
  if (!fs.existsSync(HOSTS_PATH)) return null;
  const hosts = JSON.parse(fs.readFileSync(HOSTS_PATH, 'utf8'));
  return hosts.stagingApiUrl || null;
}

function main() {
  const baseUrl = process.env.E2E_BASE_URL;
  const apiUrl = loadStagingApi();

  if (!baseUrl) {
    console.error('Set E2E_BASE_URL to your Vercel preview deployment URL.');
    process.exit(1);
  }
  if (!apiUrl || apiUrl.includes('YOUR-')) {
    console.error('Set stagingApiUrl in production-hosts.local.json or E2E_API_URL');
    process.exit(1);
  }

  console.log('\nPreview E2E smoke');
  console.log(`  Frontend: ${baseUrl}`);
  console.log(`  API: ${apiUrl}\n`);

  const env = {
    ...process.env,
    E2E_BASE_URL: baseUrl,
    E2E_API_URL: apiUrl,
  };

  const r = spawnSync('npm', ['run', 'test:e2e:explore'], {
    cwd: ROOT,
    env,
    stdio: 'inherit',
    shell: true,
  });

  if (r.status !== 0) {
    console.error('\nExplore smoke failed — check staging API health and Vercel Preview env vars.');
    process.exit(r.status ?? 1);
  }

  console.log('\nSmoke passed. Run parity: node e2e/task-explorer-sweep.mjs with same env.');
}

main();
