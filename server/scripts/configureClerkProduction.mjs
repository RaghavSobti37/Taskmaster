#!/usr/bin/env node
/**
 * Production Clerk: allowed origins, Frontend API proxy, drop org env on Render.
 *
 * Usage:
 *   node server/scripts/configureClerkProduction.mjs
 *   node server/scripts/configureClerkProduction.mjs --dry-run
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

dotenv.config({ path: path.join(ROOT, '.cursor/clerk-production.local.env') });
dotenv.config({ path: path.join(ROOT, 'server/.env') });

const dryRun = process.argv.includes('--dry-run');
const sk = process.env.CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY_LIVE || '';

const ORIGINS = [
  'https://tsccoreknot.com',
  'https://www.tsccoreknot.com',
  'https://auth.tsccoreknot.com',
  'https://landing.tsccoreknot.com',
];

/** Single registered FAPI proxy (primary host). Auth/landing hit same proxy via Vercel rewrite. */
const PROXY_URL = 'https://tsccoreknot.com/__clerk';
const DOMAIN_ID = 'dmn_3FtqpweK7eocmCYx3YevJrczYne';

/** Satellite domains with per-host proxy_url require Clerk paid plan (API 402). */

if (!sk.startsWith('sk_live_')) {
  console.error('sk_live_ required in .cursor/clerk-production.local.env');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${sk}`,
  'Content-Type': 'application/json',
};

async function clerkFetch(method, pathSuffix, body) {
  const url = `https://api.clerk.com/v1${pathSuffix}`;
  if (dryRun) {
    console.log(`[dry-run] ${method} ${url}`, body || '');
    return { ok: true, status: 204 };
  }
  const res = await fetch(url, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${pathSuffix} → ${res.status}: ${text}`);
  }
  return { ok: true, status: res.status, text };
}

async function main() {
  console.log('Configuring Clerk production…');
  await clerkFetch('PATCH', '/instance', { allowed_origins: ORIGINS });
  console.log('  allowed_origins:', ORIGINS.join(', '));

  await clerkFetch('PATCH', `/domains/${DOMAIN_ID}`, { proxy_url: PROXY_URL });
  console.log('  proxy_url:', PROXY_URL);

  console.log('Done. Deploy auth Vercel project with CLERK_SECRET_KEY for proxy function.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
