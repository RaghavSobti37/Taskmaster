#!/usr/bin/env node
/**
 * Clerk production Frontend API: clerk.tsccoreknot.com must be DNS-only (grey cloud).
 * Orange-cloud proxy → Cloudflare error 1000 / 403 and breaks login.
 *
 * Usage:
 *   node scripts/fix-clerk-dns-cloudflare.cjs
 *   node scripts/fix-clerk-dns-cloudflare.cjs --dry-run
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DOMAIN = 'tsccoreknot.com';
const CLERK_NAME = `clerk.${DOMAIN}`;
const CLERK_TARGET = 'frontend-api.clerk.services';
const dryRun = process.argv.includes('--dry-run');

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

async function cloudflareFetch(token, method, route, body) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${route}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await res.json();
  if (!res.ok || !payload.success) {
    const detail = payload?.errors?.[0]?.message || JSON.stringify(payload?.errors || payload);
    throw new Error(`Cloudflare ${method} ${route} → ${res.status}: ${detail}`);
  }
  return payload;
}

async function main() {
  const cfEnv = loadDotEnv(path.join(ROOT, '.cursor', 'cloudflare-api.local.env'));
  const token = cfEnv.CLOUDFLARE_API_TOKEN?.trim();
  let zoneId = cfEnv.CLOUDFLARE_ZONE_ID?.trim();

  if (!token) {
    console.error(
      'CLOUDFLARE_API_TOKEN missing. Copy .cursor/cloudflare-api.local.env.example → cloudflare-api.local.env\n'
      + 'Manual fix: Cloudflare → tsccoreknot.com → DNS → clerk CNAME → frontend-api.clerk.services → DNS only (grey cloud)',
    );
    process.exit(1);
  }

  if (!zoneId) {
    const zones = await cloudflareFetch(token, 'GET', `/zones?name=${encodeURIComponent(DOMAIN)}`);
    zoneId = zones.result?.[0]?.id;
  }
  if (!zoneId) throw new Error(`Cloudflare zone not found for ${DOMAIN}`);

  const list = await cloudflareFetch(
    token,
    'GET',
    `/zones/${zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(CLERK_NAME)}`,
  );
  const existing = (list.result || [])[0];
  const payload = {
    type: 'CNAME',
    name: CLERK_NAME,
    content: CLERK_TARGET,
    proxied: false,
    ttl: 1,
  };

  if (existing) {
    if (existing.content === CLERK_TARGET && existing.proxied === false) {
      console.log(`✓ ${CLERK_NAME} already DNS-only → ${CLERK_TARGET}`);
      return;
    }
    if (dryRun) {
      console.log(`[dry-run] would PATCH ${CLERK_NAME} → ${CLERK_TARGET} (proxied: false)`);
      return;
    }
    await cloudflareFetch(token, 'PATCH', `/zones/${zoneId}/dns_records/${existing.id}`, payload);
    console.log(`✓ updated ${CLERK_NAME} → ${CLERK_TARGET} (DNS only)`);
    return;
  }

  if (dryRun) {
    console.log(`[dry-run] would CREATE ${CLERK_NAME} → ${CLERK_TARGET} (proxied: false)`);
    return;
  }
  await cloudflareFetch(token, 'POST', `/zones/${zoneId}/dns_records`, payload);
  console.log(`✓ created ${CLERK_NAME} → ${CLERK_TARGET} (DNS only)`);
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
});
