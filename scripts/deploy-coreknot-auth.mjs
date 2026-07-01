#!/usr/bin/env node
/**
 * Production deploy for coreknot-auth (auth.tsccoreknot.com).
 *
 * Prereqs: Vercel CLI logged in (`npx vercel whoami`) or VERCEL_TOKEN in
 * .cursor/vercel-api.local.env
 *
 * Usage:
 *   node scripts/deploy-coreknot-auth.mjs
 *   node scripts/deploy-coreknot-auth.mjs --configure-only
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const configureOnly = process.argv.includes('--configure-only');
const proxy = process.env.RENDER_API_PROXY_URL || process.env.VITE_API_URL;
if (!proxy) {
  console.error('Set RENDER_API_PROXY_URL (or VITE_API_URL) to the Render API origin before running this script.');
  process.exit(1);
}

const run = (cmd, args, opts = {}) => {
  const result = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, RENDER_API_PROXY_URL: proxy, VITE_API_URL: proxy },
    ...opts,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run('node', ['scripts/configure-vercel-split-projects.cjs']);

if (configureOnly) {
  console.log('Project settings synced. Run without --configure-only to deploy.');
  process.exit(0);
}

run('npx', ['vercel', 'link', '--project', 'coreknot-auth', '--yes']);
run('npx', ['vercel', 'deploy', '--prod', '--yes']);
console.log('\n✓ https://auth.tsccoreknot.com/login');
