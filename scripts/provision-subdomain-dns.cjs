#!/usr/bin/env node
/**
 * Provision landing + auth subdomain DNS for CoreKnot split deploy.
 *
 * Cloudflare: CLOUDFLARE_API_TOKEN + CLOUDFLARE_ZONE_ID in
 * .cursor/cloudflare-api.local.env (zone must use Cloudflare nameservers).
 *
 * GoDaddy (current): prints exact CNAME rows when Cloudflare unavailable.
 *
 * Usage:
 *   node scripts/provision-subdomain-dns.cjs
 *   node scripts/provision-subdomain-dns.cjs --dry-run
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');

const DOMAIN = 'tsccoreknot.com';
const SUBDOMAINS = ['landing', 'auth'];

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

function parseVercelJsonOutput(blob) {
  const text = String(blob || '');
  const matches = [...text.matchAll(/\{[\s\S]*?\n\}/g)];
  if (!matches.length) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('No JSON in vercel CLI output');
    return JSON.parse(text.slice(start, end + 1));
  }
  return JSON.parse(matches[matches.length - 1][0]);
}

function vercelRecommendedRecords() {
  const records = [];
  for (const sub of SUBDOMAINS) {
    const host = `${sub}.${DOMAIN}`;
    let json;
    try {
      const raw = execSync(`npx vercel domains verify ${host}`, {
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
      });
      json = parseVercelJsonOutput(raw);
    } catch (err) {
      json = parseVercelJsonOutput(`${err.stdout || ''}${err.stderr || ''}`);
    }
    const rec = json?.recommended?.records?.[0];
    if (!rec?.value) throw new Error(`No recommended DNS record for ${host}`);
    records.push({
      host,
      type: rec.type || 'CNAME',
      name: rec.name || sub,
      target: String(rec.value).replace(/\.$/, ''),
    });
  }
  return records;
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

async function ensureCloudflareCname(token, zoneId, name, target) {
  const fqdn = name.includes('.') ? name : `${name}.${DOMAIN}`;
  const list = await cloudflareFetch(
    token,
    'GET',
    `/zones/${zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(fqdn)}`,
  );
  const existing = (list.result || [])[0];
  const payload = {
    type: 'CNAME',
    name: fqdn,
    content: target,
    proxied: false,
    ttl: 1,
  };
  if (existing) {
    if (existing.content === target && existing.proxied === false) return 'unchanged';
    if (dryRun) return 'would-update';
    await cloudflareFetch(token, 'PATCH', `/zones/${zoneId}/dns_records/${existing.id}`, payload);
    return 'updated';
  }
  if (dryRun) return 'would-create';
  await cloudflareFetch(token, 'POST', `/zones/${zoneId}/dns_records`, payload);
  return 'created';
}

function printGodaddyInstructions(records) {
  console.log('\nGoDaddy DNS (current nameservers: domaincontrol.com)\n');
  console.log('Dashboard → My Products → tsccoreknot.com → DNS → Add:\n');
  for (const rec of records) {
    console.log(`  Type: ${rec.type}`);
    console.log(`  Name: ${rec.name}`);
    console.log(`  Value: ${rec.target}`);
    console.log('  TTL: 600 (or default)\n');
  }
  console.log('After saving, verify:');
  for (const rec of records) {
    console.log(`  npx vercel domains verify ${rec.host}`);
  }
  console.log('\nCloudflare path: add zone in Cloudflare, point GoDaddy NS to Cloudflare,');
  console.log('fill .cursor/cloudflare-api.local.env, re-run this script.\n');
}

async function main() {
  console.log('\nCoreKnot subdomain DNS provision\n');
  const records = vercelRecommendedRecords();
  console.log('Vercel targets:');
  for (const rec of records) {
    console.log(`  ${rec.host} → ${rec.target}`);
  }

  const cfEnv = loadDotEnv(path.join(ROOT, '.cursor', 'cloudflare-api.local.env'));
  const token = cfEnv.CLOUDFLARE_API_TOKEN?.trim();
  let zoneId = cfEnv.CLOUDFLARE_ZONE_ID?.trim();

  if (!token) {
    console.log('\n⚠ CLOUDFLARE_API_TOKEN not set — skipping Cloudflare API.');
    printGodaddyInstructions(records);
    process.exit(1);
  }

  if (!zoneId) {
    const zones = await cloudflareFetch(token, 'GET', `/zones?name=${encodeURIComponent(DOMAIN)}`);
    zoneId = zones.result?.[0]?.id;
  }

  if (!zoneId) {
    console.log('\n⚠ Cloudflare zone not found for tsccoreknot.com.');
    printGodaddyInstructions(records);
    process.exit(1);
  }

  console.log(`\nCloudflare zone: ${zoneId}`);
  for (const rec of records) {
    const action = await ensureCloudflareCname(token, zoneId, rec.name, rec.target);
    console.log(`  ✓ ${rec.host} (${action})`);
  }

  if (!dryRun) {
    for (const rec of records) {
      try {
        execSync(`npx vercel domains verify ${rec.host}`, { cwd: ROOT, stdio: 'inherit' });
      } catch {
        console.log(`  ⚠ ${rec.host} not verified yet — DNS propagation may take a few minutes`);
      }
    }
  }

  console.log('\nDone.\n');
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
});
