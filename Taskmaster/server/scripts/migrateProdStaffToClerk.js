#!/usr/bin/env node
/**
 * Migrate all @theshakticollective.in staff from production Mongo into Clerk.
 * Runs production Clerk first (writes clerkId to prod Mongo), then dev Clerk
 * (writes clerkId to local Mongo only).
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const migrateScript = path.join(__dirname, 'migrateUsersToClerk.js');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const dryRun = process.argv.includes('--dry-run');
const extraArgs = process.argv.slice(2).filter((a) => a !== '--dry-run');

const prodLocal = parseEnvFile(path.join(ROOT, '.cursor', 'clerk-production.local.env'));
const serverEnv = parseEnvFile(path.join(ROOT, 'server', '.env'));

const targets = [
  {
    label: 'production',
    env: {
      ...process.env,
      CLERK_SECRET_KEY: prodLocal.CLERK_SECRET_KEY,
      CLERK_ORGANIZATION_ID: prodLocal.VITE_CLERK_ORGANIZATION_ID || 'org_3FuGBGD2rKedHGXGHGynClErbbq',
    },
    args: ['--staff-only', '--source', 'prod', ...extraArgs],
  },
  {
    label: 'development',
    env: {
      ...process.env,
      CLERK_SECRET_KEY: serverEnv.CLERK_SECRET_KEY,
      CLERK_ORGANIZATION_ID: serverEnv.CLERK_ORGANIZATION_ID || 'org_3FuRwJBYTGL68bXDrOsfCmziAfR',
    },
    args: ['--staff-only', '--source', 'prod', '--write-source', 'local', ...extraArgs],
  },
];

for (const target of targets) {
  console.log(`\n=== Clerk ${target.label} ===`);
  const args = [migrateScript, ...target.args];
  if (dryRun) args.push('--dry-run');
  const result = spawnSync(process.execPath, args, {
    cwd: path.join(ROOT, 'server'),
    env: target.env,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
