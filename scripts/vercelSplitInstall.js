#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { findTaskmasterRoot } = require('./findTaskmasterRoot');

const ROOT = findTaskmasterRoot();
const clientScript = fs.existsSync(path.join(ROOT, 'Taskmaster', 'client', 'scripts', 'generateVercelConfig.cjs'))
  ? 'Taskmaster/client/scripts/generateVercelConfig.cjs'
  : 'client/scripts/generateVercelConfig.cjs';
execSync(`node ${clientScript}`, {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, HUSKY: '0' },
});
execSync('node scripts/vercelInstall.js', { cwd: ROOT, stdio: 'inherit' });
