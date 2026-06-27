#!/usr/bin/env node
/**
 * Vercel install: fresh monorepo install + explicit linux native bindings.
 * ponytail: npm optional-deps bug on cross-platform CI — pin natives after install
 */
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const NPM = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const run = (args) => {
  const result = spawnSync(NPM, args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

const rm = spawnSync(process.platform === 'win32' ? 'cmd' : 'rm', process.platform === 'win32' ? ['/c', 'rmdir /s /q node_modules & rmdir /s /q client\\node_modules'] : ['-rf', 'node_modules', 'client/node_modules'], { cwd: ROOT, stdio: 'inherit', shell: true });
if (rm.status !== 0 && process.env.VERCEL) process.exit(rm.status ?? 1);

run(['--yes', 'npm@11', 'install', '--legacy-peer-deps', '--include=optional']);
run([
  '--yes', 'npm@11', 'install', '--include=optional',
  '@tailwindcss/oxide-linux-x64-gnu@4.3.0',
  '@rollup/rollup-linux-x64-gnu@4.61.1',
  'lightningcss-linux-x64-gnu@1.32.0',
]);
