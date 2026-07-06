#!/usr/bin/env node
/**
 * Push staging API URLs to Vercel Preview — staging branch uses taskmaster_staging DB.
 *
 * Usage: node scripts/push-vercel-preview-api-env.mjs
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const HOSTS_PATH = path.join(ROOT, '.cursor', 'production-hosts.local.json');
const HOSTS_EXAMPLE = path.join(ROOT, '.cursor', 'production-hosts.local.example.json');
const DEFAULT_STAGING_API = 'https://coreknot-api-staging.onrender.com';

const VERCEL_TARGETS = [
  { name: 'taskmaster', cwd: path.join(ROOT, 'client') },
  { name: 'coreknot-auth', cwd: path.join(ROOT, 'sites', 'auth') },
  { name: 'coreknot-landing', cwd: path.join(ROOT, 'sites', 'landing') },
];

const PREVIEW_ENVS = ['preview', 'development'];

function readStagingApiUrl() {
  const file = fs.existsSync(HOSTS_PATH) ? HOSTS_PATH : HOSTS_EXAMPLE;
  if (!fs.existsSync(file)) {
    return DEFAULT_STAGING_API;
  }
  try {
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    const url = String(
      json.stagingApiUrl || json.derived?.stagingApiUrl || DEFAULT_STAGING_API,
    ).trim().replace(/\/$/, '');
    if (!url || url.includes('YOUR-')) {
      return DEFAULT_STAGING_API;
    }
    return url;
  } catch (e) {
    console.error('Invalid production-hosts.local.json:', e.message);
    process.exit(1);
  }
}

function vercelUpsert(cwd, key, value, envs = PREVIEW_ENVS) {
  for (const env of envs) {
    spawnSync('npx', ['--yes', 'vercel@latest', 'env', 'rm', key, env, '--yes'], {
      cwd,
      stdio: 'ignore',
      shell: true,
    });
    const add = spawnSync(
      'npx',
      ['--yes', 'vercel@latest', 'env', 'add', key, env],
      { cwd, input: value, encoding: 'utf8', shell: true },
    );
    if (add.status !== 0) {
      throw new Error(`vercel env add ${key} @ ${path.basename(cwd)} [${env}] failed`);
    }
    console.log(`  ${path.basename(cwd)} [${env}]: ${key}=${value}`);
  }
}

const stagingApi = readStagingApiUrl();

console.log(`Pushing preview API env → ${stagingApi} (taskmaster_staging)\n`);
for (const { name, cwd } of VERCEL_TARGETS) {
  if (!fs.existsSync(cwd)) {
    console.warn(`  skip ${name} (${cwd} missing)`);
    continue;
  }
  vercelUpsert(cwd, 'VITE_API_URL', stagingApi);
  vercelUpsert(cwd, 'RENDER_API_PROXY_URL', stagingApi);
}

console.log('\nDone. Redeploy staging branch on Vercel.\n');
