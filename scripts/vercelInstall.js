#!/usr/bin/env node
/**
 * Vercel install: client workspace + explicit linux native bindings at repo root.
 * ponytail: npm optional-deps bug on cross-platform CI — pin natives after install
 */
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const NPM = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const run = (args, cwd = ROOT) => {
  const result = spawnSync(NPM, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

if (process.platform === 'win32') {
  spawnSync('cmd', ['/c', 'if exist node_modules rmdir /s /q node_modules & if exist client\\node_modules rmdir /s /q client\\node_modules'], { cwd: ROOT, stdio: 'inherit' });
} else {
  spawnSync('rm', ['-rf', 'node_modules', 'client/node_modules'], { cwd: ROOT, stdio: 'inherit' });
}

run(['--yes', 'npm@11', 'install', '--legacy-peer-deps', '--include=optional', '-w', 'CoreKnot-client']);
run([
  '--yes', 'npm@11', 'install', '--include=optional',
  '@tailwindcss/oxide-linux-x64-gnu@4.3.0',
  '@rollup/rollup-linux-x64-gnu@4.61.1',
  'lightningcss-linux-x64-gnu@1.32.0',
]);
