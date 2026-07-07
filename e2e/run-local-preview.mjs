#!/usr/bin/env node
/** Local preview-mode Playwright — builds client (loads client/.env for VITE_CLERK_*). */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, E2E_CLIENT_MODE: 'preview' };

const r = spawnSync(
  'npx',
  ['playwright', 'test', '--config', 'e2e/playwright.config.cjs', ...process.argv.slice(2)],
  { cwd: root, env, stdio: 'inherit', shell: true },
);

process.exit(r.status ?? 1);
