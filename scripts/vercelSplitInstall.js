#!/usr/bin/env node
const { execSync } = require('child_process');
const { findTaskmasterRoot } = require('./findTaskmasterRoot');

const ROOT = findTaskmasterRoot();
execSync('node client/scripts/generateVercelConfig.cjs', {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, HUSKY: '0' },
});
execSync('node scripts/vercelInstall.js', { cwd: ROOT, stdio: 'inherit' });
