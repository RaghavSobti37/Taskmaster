#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

process.env.E2E_PRODUCTION_AUTH = '1';
process.env.E2E_SKIP_WEBSERVER = '1';

const result = spawnSync(
  'npx',
  [
    'playwright',
    'test',
    '--config',
    'e2e/playwright.config.cjs',
    'e2e/production-auth-login.spec.js',
    'e2e/production-auth-network-budget.spec.js',
    ...process.argv.slice(2),
  ],
  { cwd: repoRoot, stdio: 'inherit', shell: true, env: process.env },
);

process.exit(result.status ?? 1);
