#!/usr/bin/env node
const { execSync } = require('child_process');
const { findTaskmasterRoot } = require('./findTaskmasterRoot');

const mode = process.argv[2];
if (!mode || !['landing', 'auth'].includes(mode)) {
  console.error('Usage: node scripts/vercelSplitBuild.js <landing|auth>');
  process.exit(1);
}

const ROOT = findTaskmasterRoot();
execSync(`npm run vercel-build:${mode} --prefix client`, {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, HUSKY: '0' },
});
