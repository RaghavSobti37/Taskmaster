#!/usr/bin/env node
/** One-off: create Clerk production org matching dev org settings. Prints only org id/name/slug. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function parseEnvFile(filePath) {
  const out = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

const local = parseEnvFile(path.join(ROOT, '.cursor', 'clerk-production.local.env'));
const sk = local.CLERK_SECRET_KEY;

const res = await fetch('https://api.clerk.com/v1/organizations', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${sk}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'The Shakti Collective',
  }),
});
const body = await res.json();
if (!res.ok) {
  console.error('Create org failed', res.status, JSON.stringify(body));
  process.exit(1);
}
console.log(JSON.stringify({ id: body.id, name: body.name, slug: body.slug, max_allowed_memberships: body.max_allowed_memberships }, null, 2));
