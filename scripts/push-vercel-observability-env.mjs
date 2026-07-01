#!/usr/bin/env node
/** Push non-secret Vercel env vars via CLI (uses logged-in vercel whoami). */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT = path.join(__dirname, '..', 'client');

const VARS = [
  ['VITE_RENDER_SERVICE_ID_PRODUCTION', 'srv-d37a5m1r0fns739brt40'],
  ['VITE_RENDER_SERVICE_ID_STAGING_API', 'srv-d8vm9flaeets73d7l6r0'],
  ['VITE_RENDER_SERVICE_ID_STAGING_NEST', 'srv-d8vm9gbsq97s738h8plg'],
  ['VITE_POSTHOG_PROJECT_ID', '468825'],
  ['VITE_POSTHOG_APP_URL', 'https://us.posthog.com/project/468825'],
];

function upsert(key, value, envs = ['production', 'preview', 'development']) {
  for (const env of envs) {
    spawnSync('npx', ['--yes', 'vercel@latest', 'env', 'rm', key, env, '--yes'], {
      cwd: CLIENT,
      stdio: 'ignore',
      shell: true,
    });
    const input = spawnSync(
      'npx',
      ['--yes', 'vercel@latest', 'env', 'add', key, env],
      {
        cwd: CLIENT,
        input: value,
        encoding: 'utf8',
        shell: true,
      },
    );
    if (input.status !== 0) {
      throw new Error(`vercel env add ${key} ${env} failed: ${input.stderr || input.stdout}`);
    }
  }
  console.log(`Vercel: set ${key}`);
}

for (const [key, value] of VARS) {
  upsert(key, value);
}

console.log('Vercel public env vars updated.');
