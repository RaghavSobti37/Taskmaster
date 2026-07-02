#!/usr/bin/env node
/**
 * Push Clerk *development* keys (pk_test_) to Vercel Preview + Development.
 * Reads client/.env.development — safe for branch previews (taskmaster-git-dev-…).
 *
 * Usage: node scripts/push-clerk-preview-env.mjs
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const VERCEL_TARGETS = [
  { name: 'taskmaster', cwd: path.join(ROOT, 'client') },
  { name: 'coreknot-auth', cwd: path.join(ROOT, 'sites', 'auth') },
  { name: 'coreknot-landing', cwd: path.join(ROOT, 'sites', 'landing') },
];

const PREVIEW_ENVS = ['preview', 'development'];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
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
    console.log(`  ${path.basename(cwd)} [${env}]: ${key}`);
  }
}

const dev = parseEnvFile(path.join(ROOT, 'client', '.env.development'));
const pk = dev.VITE_CLERK_PUBLISHABLE_KEY || dev.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
const orgId = dev.VITE_CLERK_ORGANIZATION_ID || '';

if (!pk.startsWith('pk_test_')) {
  console.error('Set pk_test_ in client/.env.development (VITE_CLERK_PUBLISHABLE_KEY)');
  process.exit(1);
}

console.log('Pushing Clerk preview/dev keys to Vercel…');
for (const { cwd } of VERCEL_TARGETS) {
  if (!fs.existsSync(cwd)) {
    console.warn(`  skip ${cwd} (missing)`);
    continue;
  }
  vercelUpsert(cwd, 'VITE_CLERK_PUBLISHABLE_KEY', pk);
  vercelUpsert(cwd, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', pk);
  if (orgId) vercelUpsert(cwd, 'VITE_CLERK_ORGANIZATION_ID', orgId);
}

console.log('Done. Redeploy preview branch (or push to dev) for env to bake into build.');
