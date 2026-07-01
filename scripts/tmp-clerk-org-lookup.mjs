#!/usr/bin/env node
/** One-off: list/create Clerk production org using sk_live from .cursor/clerk-production.local.env. Prints no secrets. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
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
if (!sk || !sk.startsWith('sk_live_')) {
  console.error('No sk_live_ key found in .cursor/clerk-production.local.env');
  process.exit(1);
}

const res = await fetch('https://api.clerk.com/v1/organizations?limit=20', {
  headers: { Authorization: `Bearer ${sk}` },
});
const body = await res.json();
if (!res.ok) {
  console.error('Clerk API error', res.status, JSON.stringify(body));
  process.exit(1);
}
const orgs = (body.data || body || []).map((o) => ({
  id: o.id,
  name: o.name,
  slug: o.slug,
  max_allowed_memberships: o.max_allowed_memberships,
}));
console.log(JSON.stringify({ totalCount: body.total_count, orgs }, null, 2));
