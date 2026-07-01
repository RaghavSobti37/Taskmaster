#!/usr/bin/env node
/**
 * Push Clerk *production* keys (pk_live_/sk_live_) to Vercel + Render.
 *
 * Prereq: Clerk production instance created in Dashboard (not glad-monkey-58 dev).
 * Keys: .cursor/clerk-production.local.env (copy from .example) OR server/.env:
 *   CLERK_PUBLISHABLE_KEY_LIVE, CLERK_SECRET_KEY_LIVE, CLERK_ORGANIZATION_ID_LIVE
 *
 * Usage:
 *   node scripts/push-clerk-production-env.mjs
 *   node scripts/push-clerk-production-env.mjs --deploy
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// NOTE: the main app's production domain (tsccoreknot.com) is served by the
// Vercel project named "taskmaster", NOT "tsc-coreknot" (that project serves
// the unrelated coreknot.in domain). Pushing Clerk keys to "tsc-coreknot" was
// a prior misconfiguration that caused the auth bridge to see a stale/wrong
// publishable key on the main app.
const VERCEL_PROJECTS = [
  { name: 'coreknot-auth', cwd: path.join(ROOT, 'sites', 'auth'), needsClerkSecret: true },
  { name: 'taskmaster', cwd: path.join(ROOT, 'client'), needsClerkSecret: true },
];

const RENDER_SERVICE_ID = 'srv-d37a5m1r0fns739brt40';

const deploy = process.argv.includes('--deploy');

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

function loadKeys() {
  const local = parseEnvFile(path.join(ROOT, '.cursor', 'clerk-production.local.env'));
  const server = parseEnvFile(path.join(ROOT, 'server', '.env'));
  const pk =
    local.VITE_CLERK_PUBLISHABLE_KEY
    || local.CLERK_PUBLISHABLE_KEY_LIVE
    || server.CLERK_PUBLISHABLE_KEY_LIVE
    || '';
  const sk =
    local.CLERK_SECRET_KEY
    || local.CLERK_SECRET_KEY_LIVE
    || server.CLERK_SECRET_KEY_LIVE
    || '';
  return { pk, sk };
}

function assertLiveKeys({ pk, sk }) {
  if (!pk.startsWith('pk_live_')) {
    console.error(
      'Missing pk_live_ key. Create Clerk production instance:\n'
      + '  1. https://dashboard.clerk.com → Development dropdown → Create production instance\n'
      + '  2. Add domain tsccoreknot.com + deploy certificates\n'
      + '  3. Copy Production API keys → .cursor/clerk-production.local.env\n'
      + '  Or: npx clerk@latest deploy && npx clerk@latest env pull --instance prod\n',
    );
    process.exit(1);
  }
  if (!sk.startsWith('sk_live_')) {
    console.error('Missing sk_live_ in clerk-production.local.env or server/.env CLERK_SECRET_KEY_LIVE');
    process.exit(1);
  }
}

function vercelUpsert(cwd, key, value, envs = ['production']) {
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
      throw new Error(`vercel env add ${key} @ ${path.basename(cwd)} failed`);
    }
    console.log(`  Vercel ${path.basename(cwd)} [${env}]: ${key}`);
  }
}

function loadRenderApiKey() {
  for (const file of [
    path.join(ROOT, 'server', '.env'),
    path.join(ROOT, '.cursor', 'render-api.local.env'),
  ]) {
    const env = parseEnvFile(file);
    if (env.RENDER_API_KEY) return env.RENDER_API_KEY;
  }
  return process.env.RENDER_API_KEY || '';
}

async function renderUpsert(sk) {
  const token = loadRenderApiKey();
  if (!token) {
    console.warn('  Render: skipped (no RENDER_API_KEY)');
    return;
  }
  const upserts = [
    ['CLERK_SECRET_KEY', sk],
  ];

  for (const [key, value] of upserts) {
    // Add-or-update single env var: PUT .../env-vars/{key} — POST is not supported here.
    const url = `https://api.render.com/v1/services/${RENDER_SERVICE_ID}/env-vars/${key}`;
    const r = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value }),
    });
    if (!r.ok) throw new Error(`Render env ${key}: ${r.status} ${await r.text()}`);
    console.log(`  Render production: ${key}`);
  }

  // ponytail: clear org pin — users-only auth (organizations removed)
  const delUrl = `https://api.render.com/v1/services/${RENDER_SERVICE_ID}/env-vars/CLERK_ORGANIZATION_ID`;
  const del = await fetch(delUrl, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (del.ok || del.status === 404) {
    console.log('  Render production: CLERK_ORGANIZATION_ID removed (if present)');
  } else {
    console.warn(`  Render: could not remove CLERK_ORGANIZATION_ID (${del.status})`);
  }
}

function deployProjects() {
  for (const { name, cwd } of VERCEL_PROJECTS) {
    spawnSync('npx', ['--yes', 'vercel@latest', 'link', '--project', name, '--yes'], {
      cwd,
      stdio: 'inherit',
      shell: true,
    });
    spawnSync('npx', ['--yes', 'vercel@latest', 'deploy', '--prod', '--yes'], {
      cwd,
      stdio: 'inherit',
      shell: true,
    });
    console.log(`  Deployed ${name}`);
  }
}

const keys = loadKeys();
assertLiveKeys(keys);

console.log('Pushing Clerk production keys…');
for (const { cwd, needsClerkSecret } of VERCEL_PROJECTS) {
  vercelUpsert(cwd, 'VITE_CLERK_PUBLISHABLE_KEY', keys.pk);
  vercelUpsert(cwd, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', keys.pk);
  if (needsClerkSecret) {
    vercelUpsert(cwd, 'CLERK_SECRET_KEY', keys.sk);
  }
  // Remove legacy org pin from Vercel if present
  for (const env of ['production']) {
    spawnSync('npx', ['--yes', 'vercel@latest', 'env', 'rm', 'VITE_CLERK_ORGANIZATION_ID', env, '--yes'], {
      cwd,
      stdio: 'ignore',
      shell: true,
    });
  }
}
await renderUpsert(keys.sk);

console.log('Applying Clerk Dashboard proxy + origins…');
const cfg = spawnSync('node', ['server/scripts/configureClerkProduction.mjs'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: true,
});
if (cfg.status !== 0) process.exit(cfg.status || 1);

console.log('Done. Redeploy required for changes to take effect.');

if (deploy) {
  console.log('Redeploying Vercel projects…');
  deployProjects();
}
