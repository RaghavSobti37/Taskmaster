#!/usr/bin/env node
/** Set PostHog Vercel env from server/.env via logged-in Vercel CLI. Never prints token. */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { parseEnvFile } = require('./loadRenderApiKey.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CLIENT = path.join(ROOT, 'client');

parseEnvFile(path.join(ROOT, 'server', '.env'));

const token = (process.env.POSTHOG_PROJECT_API_KEY || '').trim();
if (!token) {
  console.error('POSTHOG_PROJECT_API_KEY missing in server/.env');
  process.exit(1);
}

const phHost = (process.env.POSTHOG_HOST || 'https://us.i.posthog.com').trim();
const vars = {
  VITE_POSTHOG_PROJECT_TOKEN: token,
  VITE_POSTHOG_KEY: token,
  VITE_POSTHOG_HOST: phHost,
  VITE_POSTHOG_PROJECT_ID: '468825',
  VITE_POSTHOG_APP_URL: 'https://us.posthog.com/project/468825',
};

function run(cmd, args, input) {
  const r = spawnSync(cmd, args, {
    cwd: CLIENT,
    input,
    encoding: 'utf8',
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return r;
}

for (const [key, value] of Object.entries(vars)) {
  for (const env of ['production', 'preview', 'development']) {
    run('npx', ['--yes', 'vercel@latest', 'env', 'rm', key, env, '--yes']);
    const add = run('npx', ['--yes', 'vercel@latest', 'env', 'add', key, env, '--force'], `${value}\n`);
    if (add.status !== 0) {
      console.error(`Failed ${key} ${env}: ${(add.stderr || add.stdout || '').slice(0, 300)}`);
      process.exit(1);
    }
    console.log(`Vercel: set ${key} (${env})`);
  }
}

console.log('Vercel PostHog env complete.');
