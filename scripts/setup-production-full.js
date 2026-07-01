#!/usr/bin/env node
/**
 * One-shot production setup: vercel configs, Render env, optional Vercel env + Cloudflare DNS.
 *
 * Prerequisites (gitignored):
 *   .cursor/production-hosts.local.json   — real API + frontend URLs
 *   .cursor/render-api.local.env          — RENDER_API_KEY=rnd_...
 *   .cursor/vercel-api.local.env          — VERCEL_TOKEN=... (optional)
 *   .cursor/cloudflare-api.local.env      — CLOUDFLARE_API_TOKEN + CLOUDFLARE_ZONE_ID (optional)
 *   .cursor/posthog.local.env             — POSTHOG keys (optional)
 *
 * Usage:
 *   node scripts/setup-production-full.js --dry-run
 *   node scripts/setup-production-full.js --all
 *   node scripts/setup-production-full.js --render --vercel --smoke
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');
const { loadRenderApiKey, parseEnvFile } = require('./loadRenderApiKey');

const ROOT = path.join(__dirname, '..');
const HOSTS_PATH = path.join(ROOT, '.cursor', 'production-hosts.local.json');

const DOMAINS = {
  app: 'tsccoreknot.com',
  www: 'www.tsccoreknot.com',
  landing: 'landing.tsccoreknot.com',
  auth: 'auth.tsccoreknot.com',
};

const VERCEL_PROJECTS = [
  { name: 'taskmaster', root: 'client', domains: [DOMAINS.app, DOMAINS.www], siteMode: 'app' },
  { name: 'coreknot-landing', root: 'sites/landing', domains: [DOMAINS.landing], siteMode: 'landing' },
  { name: 'coreknot-auth', root: 'sites/auth', domains: [DOMAINS.auth], siteMode: 'auth' },
];

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const runAll = args.has('--all');
const runRender = runAll || args.has('--render');
const runVercel = runAll || args.has('--vercel');
const runCloudflare = runAll || args.has('--cloudflare');
const runSmoke = runAll || args.has('--smoke');
const runConfigs = runAll || args.has('--configs') || (!runRender && !runVercel && !runCloudflare && !runSmoke);

const log = (msg) => console.log(msg);
const ok = (msg) => log(`  ✓ ${msg}`);
const warn = (msg) => log(`  ⚠ ${msg}`);
const fail = (msg) => log(`  ✗ ${msg}`);

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  parseEnvFile(filePath);
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

function readHosts() {
  if (!fs.existsSync(HOSTS_PATH)) {
    fail(`Missing ${HOSTS_PATH}`);
    log('  Copy .cursor/production-hosts.local.example.json and fill real URLs.');
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(HOSTS_PATH, 'utf8'));
  } catch (e) {
    fail(`Invalid production-hosts.local.json: ${e.message}`);
    return null;
  }
}

function apiUrl(hosts) {
  const raw = hosts?.derived?.renderApiProxyUrl || hosts?.productionApiUrl || '';
  return String(raw).trim().replace(/\/$/, '');
}

function frontendUrl(hosts) {
  return String(hosts?.productionFrontendUrl || `https://${DOMAINS.app}`).trim().replace(/\/$/, '');
}

async function renderFetch(apiKey, method, route, body) {
  const res = await fetch(`https://api.render.com/v1${route}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = text; }
  }
  if (!res.ok) {
    const detail = payload?.message || (typeof payload === 'string' ? payload : JSON.stringify(payload));
    throw new Error(`${method} ${route} → ${res.status}: ${detail}`);
  }
  return payload;
}

async function vercelFetch(token, method, route, body) {
  const res = await fetch(`https://api.vercel.com${route}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = text; }
  }
  if (!res.ok) {
    const detail = payload?.error?.message || payload?.message || text;
    throw new Error(`Vercel ${method} ${route} → ${res.status}: ${detail}`);
  }
  return payload;
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

function mergeCorsOrigins(existing, required) {
  const set = new Set();
  for (const item of String(existing || '').split(',')) {
    const v = item.trim();
    if (v) set.add(v);
  }
  for (const url of required) set.add(url);
  return [...set].join(',');
}

async function listRenderServices(apiKey) {
  const services = [];
  let cursor = null;
  do {
    const query = new URLSearchParams({ limit: '100' });
    if (cursor) query.set('cursor', cursor);
    const page = await renderFetch(apiKey, 'GET', `/services?${query}`);
    for (const row of page || []) {
      if (row?.service) services.push(row.service);
    }
    cursor = page?.cursor || null;
  } while (cursor);
  return services;
}

function pickProductionApi(services) {
  return services.find((s) => /^coreknot-api$/i.test(String(s.name)))
    || services.find((s) => /^taskmaster$/i.test(String(s.name)))
    || null;
}

async function stepConfigs(hosts) {
  log('\n=== 1. Regenerate vercel.json files ===\n');
  const proxy = apiUrl(hosts);
  if (!proxy || proxy.includes('YOUR-')) {
    fail('production-hosts.local.json missing real productionApiUrl');
    return false;
  }

  if (dryRun) {
    ok(`Would run generateVercelConfig with RENDER_API_PROXY_URL=${proxy}`);
    return true;
  }

  execSync('node client/scripts/generateVercelConfig.cjs', {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, RENDER_API_PROXY_URL: proxy, VITE_API_URL: proxy },
  });
  ok('vercel.json files regenerated');
  return true;
}

async function stepRender(hosts, posthogEnv) {
  log('\n=== 2. Render API environment ===\n');
  const apiKey = loadRenderApiKey();
  if (!apiKey) {
    fail('RENDER_API_KEY missing — copy .cursor/render-api.local.env.example');
    return false;
  }

  const services = await listRenderServices(apiKey);
  const svc = pickProductionApi(services);
  if (!svc?.id) {
    fail('Could not find CoreKnot-api / taskmaster service on Render');
    return false;
  }

  const app = frontendUrl(hosts);
  const envUpdates = [
    { key: 'FRONTEND_URL', value: app },
    { key: 'CLIENT_URL', value: app },
    { key: 'AUTH_FRONTEND_URL', value: `https://${DOMAINS.auth}` },
    {
      key: 'CORS_ALLOWED_ORIGINS',
      value: mergeCorsOrigins(process.env.CORS_ALLOWED_ORIGINS, [
        app,
        `https://${DOMAINS.www}`,
        `https://${DOMAINS.landing}`,
        `https://${DOMAINS.auth}`,
      ]),
    },
  ];

  if (posthogEnv.POSTHOG_PROJECT_API_KEY) {
    envUpdates.push({ key: 'POSTHOG_PROJECT_API_KEY', value: posthogEnv.POSTHOG_PROJECT_API_KEY });
  }
  if (posthogEnv.POSTHOG_HOST) {
    envUpdates.push({ key: 'POSTHOG_HOST', value: posthogEnv.POSTHOG_HOST });
  }

  log(`  Service: ${svc.name} (${svc.id})`);
  for (const { key, value } of envUpdates) {
    const display = key.includes('KEY') ? `${value.slice(0, 8)}…` : value;
    if (dryRun) {
      ok(`Would set ${key}=${display}`);
      continue;
    }
    await renderFetch(apiKey, 'PUT', `/services/${svc.id}/env-vars/${encodeURIComponent(key)}`, {
      value,
    });
    ok(`Set ${key}`);
  }

  if (!dryRun && (runAll || args.has('--deploy'))) {
    await renderFetch(apiKey, 'POST', `/services/${svc.id}/deploys`, { clearCache: 'do_not_clear' });
    ok('Deploy triggered');
  }

  return true;
}

function vercelEnvForProject(siteMode, hosts, posthogEnv) {
  const proxy = apiUrl(hosts);
  const base = [
    { key: 'RENDER_API_PROXY_URL', value: proxy, target: ['production', 'preview'] },
    { key: 'VITE_API_URL', value: proxy, target: ['production', 'preview'] },
  ];
  if (siteMode === 'app') {
    base.push(
      { key: 'VITE_LANDING_URL', value: `https://${DOMAINS.landing}`, target: ['production'] },
      { key: 'VITE_AUTH_URL', value: `https://${DOMAINS.auth}`, target: ['production'] },
      { key: 'VITE_APP_URL', value: frontendUrl(hosts), target: ['production'] },
    );
    if (posthogEnv.VITE_POSTHOG_PROJECT_TOKEN) {
      base.push(
        { key: 'VITE_POSTHOG_PROJECT_TOKEN', value: posthogEnv.VITE_POSTHOG_PROJECT_TOKEN, target: ['production'] },
        { key: 'VITE_POSTHOG_HOST', value: posthogEnv.VITE_POSTHOG_HOST || 'https://us.i.posthog.com', target: ['production'] },
        { key: 'VITE_POSTHOG_APP_URL', value: frontendUrl(hosts), target: ['production'] },
      );
    }
  }
  return base;
}

async function upsertVercelEnv(token, projectId, entry) {
  const existing = await vercelFetch(token, 'GET', `/v9/projects/${projectId}/env`);
  const match = (existing?.envs || []).find(
    (e) => e.key === entry.key && JSON.stringify(e.target) === JSON.stringify(entry.target),
  );
  if (match) {
    await vercelFetch(token, 'PATCH', `/v9/projects/${projectId}/env/${match.id}`, {
      value: entry.value,
      target: entry.target,
    });
    return 'updated';
  }
  await vercelFetch(token, 'POST', `/v10/projects/${projectId}/env`, {
    key: entry.key,
    value: entry.value,
    type: 'encrypted',
    target: entry.target,
  });
  return 'created';
}

async function stepVercel(hosts, vercelEnv, posthogEnv) {
  log('\n=== 3. Vercel environment (3 projects) ===\n');
  const token = vercelEnv.VERCEL_TOKEN?.trim();
  if (!token) {
    fail('VERCEL_TOKEN missing — copy .cursor/vercel-api.local.env.example');
    log('  Manual: Vercel Dashboard → each project → Settings → Environment Variables');
    log('  See docs/CLOUDFLARE_DNS.md section 3');
    return false;
  }

  const teamQuery = vercelEnv.VERCEL_TEAM_ID ? `?teamId=${vercelEnv.VERCEL_TEAM_ID}` : '';
  const projects = await vercelFetch(token, 'GET', `/v9/projects${teamQuery}`);
  const byName = new Map((projects?.projects || []).map((p) => [p.name.toLowerCase(), p]));

  for (const spec of VERCEL_PROJECTS) {
    const project = byName.get(spec.name.toLowerCase());
    if (!project?.id) {
      warn(`Project "${spec.name}" not found — create in Vercel with root ${spec.root}`);
      continue;
    }
    log(`  Project: ${spec.name}`);
    const entries = vercelEnvForProject(spec.siteMode, hosts, posthogEnv);
    for (const entry of entries) {
      if (dryRun) {
        ok(`Would set ${entry.key} on ${spec.name}`);
        continue;
      }
      const action = await upsertVercelEnv(token, project.id, entry);
      ok(`${entry.key} ${action}`);
    }
  }

  return true;
}

async function ensureCloudflareRecord(token, zoneId, name, target, proxied = false) {
  const list = await cloudflareFetch(token, 'GET', `/zones/${zoneId}/dns_records?name=${encodeURIComponent(name)}`);
  const existing = (list.result || []).find((r) => r.type === 'CNAME' || r.type === 'A');
  const payload = {
    type: 'CNAME',
    name,
    content: target,
    proxied,
    ttl: 1,
  };
  if (existing) {
    if (existing.content === target && existing.proxied === proxied) {
      return 'unchanged';
    }
    if (dryRun) return 'would-update';
    await cloudflareFetch(token, 'PATCH', `/zones/${zoneId}/dns_records/${existing.id}`, payload);
    return 'updated';
  }
  if (dryRun) return 'would-create';
  await cloudflareFetch(token, 'POST', `/zones/${zoneId}/dns_records`, payload);
  return 'created';
}

async function stepCloudflare(cfEnv) {
  log('\n=== 4. Cloudflare DNS ===\n');
  const token = cfEnv.CLOUDFLARE_API_TOKEN?.trim();
  const zoneId = cfEnv.CLOUDFLARE_ZONE_ID?.trim();
  if (!token || !zoneId) {
    fail('CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID missing');
    log('  Copy .cursor/cloudflare-api.local.env.example');
    log('  Or run: node scripts/provision-subdomain-dns.mjs (prints GoDaddy CNAME rows)');
    log('  Note: tsccoreknot.com currently uses GoDaddy nameservers — migrate to Cloudflare or add records at GoDaddy.');
    return false;
  }

  if (dryRun) {
    ok('Would run scripts/provision-subdomain-dns.mjs for landing + auth CNAME targets from Vercel');
    return true;
  }

  try {
    execSync('node scripts/provision-subdomain-dns.cjs', { cwd: ROOT, stdio: 'inherit' });
    ok('Subdomain DNS provisioned via Cloudflare');
    return true;
  } catch {
    fail('provision-subdomain-dns.mjs failed — add CNAME records at your DNS provider');
    return false;
  }
}

function fetchHead(url) {
  return new Promise((resolve) => {
    https.get(url, { timeout: 20000 }, (res) => {
      res.resume();
      resolve(res.statusCode);
    }).on('error', () => resolve(0));
  });
}

async function stepSmoke() {
  log('\n=== 5. Smoke checks ===\n');
  const checks = [
    `https://${DOMAINS.landing}/`,
    `https://${DOMAINS.auth}/login`,
    `https://${DOMAINS.app}/api/health`,
    `https://${DOMAINS.auth}/api/health`,
  ];

  let allOk = true;
  for (const url of checks) {
    const status = await fetchHead(url);
    if (status >= 200 && status < 400) {
      ok(`${url} → ${status}`);
    } else {
      fail(`${url} → ${status || 'unreachable'}`);
      allOk = false;
    }
  }
  return allOk;
}

async function main() {
  log('\nCoreKnot production setup');
  if (dryRun) log('(dry-run — no changes)\n');

  const hosts = readHosts();
  if (!hosts) process.exit(1);

  const posthogEnv = loadDotEnv(path.join(ROOT, '.cursor', 'posthog.local.env'));
  const vercelEnv = loadDotEnv(path.join(ROOT, '.cursor', 'vercel-api.local.env'));
  const cfEnv = loadDotEnv(path.join(ROOT, '.cursor', 'cloudflare-api.local.env'));

  const results = [];

  if (runConfigs) results.push(await stepConfigs(hosts));
  if (runRender) results.push(await stepRender(hosts, posthogEnv));
  if (runVercel) results.push(await stepVercel(hosts, vercelEnv, posthogEnv));
  if (runCloudflare) results.push(await stepCloudflare(cfEnv));
  if (runSmoke) results.push(await stepSmoke());

  log('');
  if (results.some((r) => r === false)) {
    log('Some steps need credentials or manual dashboard work.');
    log('See docs/CLOUDFLARE_DNS.md and run: npm run production:readiness\n');
    process.exit(1);
  }

  log('Setup steps completed.');
  log('Next: deploy all 3 Vercel projects (git push or Vercel Dashboard redeploy).\n');
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
});
