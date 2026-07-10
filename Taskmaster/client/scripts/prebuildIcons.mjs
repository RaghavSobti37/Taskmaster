/**
 * ponytail: icons committed; sharp fails on Vercel linux — skip regen in CI
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (process.env.VERCEL) {
  console.log('[prebuild] Vercel: skip sharp icon regen (using committed assets)');
  process.exit(0);
}

const run = (script) => {
  const result = spawnSync(process.execPath, [path.join(__dirname, script)], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run('generate-pwa-icons.mjs');
run('generate-og-preview.mjs');
