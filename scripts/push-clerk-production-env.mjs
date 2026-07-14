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
/** Must match Clerk Dashboard registered FAPI proxy (OAuth redirect_uri host). */
const REGISTERED_CLERK_PROXY = 'https://tsccoreknot.com/__clerk';

const VERCEL_PROJECTS = [
  {
    name: 'coreknot-auth',
    cwd: path.join(ROOT, 'sites', 'auth'),
    needsClerkSecret: true,
    // Auth host started OAuth with auth…/__clerk cookies → Google returned to
    // tsccoreknot.com/__clerk/v1/oauth_callback → authorization_invalid.
    clerkProxyUrl: REGISTERED_CLERK_PROXY,
  },
  {
    name: 'taskmaster',
    cwd: path.join(ROOT, 'client'),
    needsClerkSecret: true,
    clerkProxyUrl: REGISTERED_CLERK_PROXY,
  },
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
  const orgId =
    local.VITE_CLERK_ORGANIZATION_ID
    || local.CLERK_ORGANIZATION_ID_LIVE
    || server.CLERK_ORGANIZATION_ID_LIVE
    || '';
  return { pk, sk, orgId };
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

// Preview branch deploys hit production API/DB — same pk_live_/org as production.
const VERCEL_ENVS = ['production', 'preview'];

function vercelUpsert(cwd, key, value, envs = VERCEL_ENVS) {
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

function vercelRemove(cwd, key, envs = ['preview']) {
  for (const env of envs) {
    spawnSync('npx', ['--yes', 'vercel@latest', 'env', 'rm', key, env, '--yes'], {
      cwd,
      stdio: 'ignore',
      shell: true,
    });
    console.log(`  Vercel ${path.basename(cwd)} [${env}]: removed ${key}`);
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

async function renderUpsert(sk, orgId) {
  const token = loadRenderApiKey();
  if (!token) {
    console.warn('  Render: skipped (no RENDER_API_KEY)');
    return;
  }
  const upserts = [
    ['CLERK_SECRET_KEY', sk],
    ['CLERK_FAPI_UPSTREAM', 'https://frontend-api.clerk.dev'],
    ['CLERK_PROXY_PUBLIC_URL', 'https://tsccoreknot.com/__clerk'],
  ];
  if (orgId) upserts.push(['CLERK_ORGANIZATION_ID', orgId]);

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

  for (const staleKey of ['CLERK_FRONTEND_API']) {
    const staleDel = await fetch(
      `https://api.render.com/v1/services/${RENDER_SERVICE_ID}/env-vars/${staleKey}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
    );
    if (staleDel.ok || staleDel.status === 404) {
      console.log(`  Render production: ${staleKey} removed (if present)`);
    }
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
if (!keys.orgId) {
  console.warn('  Warning: no VITE_CLERK_ORGANIZATION_ID — org-gated auth may fail until set');
}

console.log('Pushing Clerk production keys…');
for (const { cwd, needsClerkSecret, clerkProxyUrl, name } of VERCEL_PROJECTS) {
  vercelUpsert(cwd, 'VITE_CLERK_PUBLISHABLE_KEY', keys.pk);
  vercelUpsert(cwd, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', keys.pk);
  vercelUpsert(cwd, 'VITE_CLERK_PROXY_URL', clerkProxyUrl, ['production']);
  vercelRemove(cwd, 'VITE_CLERK_PROXY_URL', ['preview']);
  if (name === 'coreknot-auth') {
    vercelUpsert(cwd, 'VITE_SITE_MODE', 'auth');
    vercelUpsert(cwd, 'VITE_APP_URL', 'https://tsccoreknot.com');
    vercelUpsert(cwd, 'VITE_AUTH_URL', 'https://auth.tsccoreknot.com');
  }
  if (keys.orgId) {
    vercelUpsert(cwd, 'VITE_CLERK_ORGANIZATION_ID', keys.orgId);
  }
  if (needsClerkSecret) {
    vercelUpsert(cwd, 'CLERK_SECRET_KEY', keys.sk);
    vercelUpsert(cwd, 'CLERK_FAPI_UPSTREAM', 'https://frontend-api.clerk.dev');
    vercelUpsert(cwd, 'CLERK_PROXY_PUBLIC_URL', clerkProxyUrl, ['production']);
    vercelRemove(cwd, 'CLERK_PROXY_PUBLIC_URL', ['preview']);
  }
}
await renderUpsert(keys.sk, keys.orgId);

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
