#!/usr/bin/env node
/**
 * Apply Clerk auth strategy: OTP/email code at sign-up only; password for sign-in.
 *
 * Requires CLERK_SECRET_KEY in server/.env (or env).
 *
 * Usage:
 *   node server/scripts/configureClerkAuth.js --dry-run
 *   node server/scripts/configureClerkAuth.js --yes
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { spawnSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const yes = args.includes('--yes');
const configPath = path.join(__dirname, '../../clerk-auth.config.json');

if (!process.env.CLERK_SECRET_KEY) {
  console.error('CLERK_SECRET_KEY required in server/.env');
  process.exit(1);
}

const clerkArgs = [
  'clerk@latest',
  'config',
  'patch',
  '--file',
  configPath,
];
if (dryRun) clerkArgs.push('--dry-run');
if (yes) clerkArgs.push('--yes');

console.log(`Running: npx ${clerkArgs.join(' ')}`);
const result = spawnSync('npx', clerkArgs, {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env },
});

if (result.status !== 0) {
  console.error('\nClerk CLI patch failed. Manual Dashboard path:');
  console.error('  User & authentication → Email');
  console.error('    Sign-up: enable email + Email verification code');
  console.error('    Sign-in: disable Email verification code; enable Password');
  process.exit(result.status || 1);
}

console.log('\nClerk auth config applied. Sign-up uses email OTP; sign-in uses password.');
