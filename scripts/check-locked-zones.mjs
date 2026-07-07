#!/usr/bin/env node
import { execSync } from 'node:child_process';

const ALLOW = process.env.ALLOW_LOCKED_ZONE_CHANGES === 'true';
const against = process.argv[2] || 'HEAD~1';

const LOCKED_PREFIXES = [
  'server/domains/mail/webhooks/',
  'server/services/email',
  'server/services/newsletter',
  'client/src/components/brand/',
  'client/public/logo.png',
  'client/public/coreknot-logo.png',
  'client/public/brand-mark.svg',
  'client/public/favicon.svg',
];

function listChanged(baseRef) {
  try {
    const out = execSync(`git diff --name-only ${baseRef}...HEAD`, { encoding: 'utf8' }).trim();
    return out ? out.split('\n') : [];
  } catch {
    return [];
  }
}

const changed = listChanged(against);
const lockedTouched = changed.filter((file) => LOCKED_PREFIXES.some((prefix) => file.startsWith(prefix)));

if (lockedTouched.length && !ALLOW) {
  console.error('Locked zone change detected.');
  console.error('Set ALLOW_LOCKED_ZONE_CHANGES=true only for approved override.');
  for (const file of lockedTouched) console.error(` - ${file}`);
  process.exit(1);
}

console.log(`Locked zone check passed (against ${against}).`);
