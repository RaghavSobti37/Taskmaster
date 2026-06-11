#!/usr/bin/env node
/**
 * Writes vercel.json /api rewrites from RENDER_API_PROXY_URL at build time.
 * Lives under client/scripts (.cjs) so Vercel Root Directory builds stay self-contained.
 */
const fs = require('fs');
const path = require('path');

const CLIENT_ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.join(CLIENT_ROOT, '..');

const readLocalProductionApiUrl = () => {
  const localHosts = path.join(REPO_ROOT, '.cursor', 'production-hosts.local.json');
  if (!fs.existsSync(localHosts)) return '';
  try {
    const json = JSON.parse(fs.readFileSync(localHosts, 'utf8'));
    return String(
      json.derived?.renderApiProxyUrl
      || json.productionApiUrl
      || '',
    ).trim().replace(/\/$/, '');
  } catch {
    return '';
  }
};

/** Suspended / wrong hosts — never proxy mobile /api traffic here. */
const BANNED_PROXY_HOSTS = new Set([
  'coreknot-jfw0.onrender.com',
  'your-render-service.onrender.com',
]);

const normalizeProxyUrl = (raw) => String(raw || '').trim().replace(/\/$/, '');

const pickProxyUrl = () => {
  const candidates = [
    process.env.RENDER_API_PROXY_URL,
    process.env.VITE_API_URL,
    readLocalProductionApiUrl(),
  ].map(normalizeProxyUrl).filter(Boolean);

  for (const url of candidates) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (!BANNED_PROXY_HOSTS.has(host)) return url;
      console.warn(`[generateVercelConfig] skipping banned proxy host: ${host}`);
    } catch {
      /* ignore */
    }
  }
  return '';
};

const proxyUrl = pickProxyUrl();
const onVercel = process.env.VERCEL === '1';

if (onVercel && !proxyUrl) {
  console.error(
    '[generateVercelConfig] RENDER_API_PROXY_URL required on Vercel — mobile login /api proxy will 404.'
  );
  process.exit(1);
}

const templatePath = path.join(CLIENT_ROOT, 'vercel.json.example');
const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

let apiDestination = 'https://YOUR-RENDER-SERVICE.onrender.com/api/$1';
let socketDestination = 'https://YOUR-RENDER-SERVICE.onrender.com/socket.io/$1';
if (proxyUrl) {
  let parsed;
  try {
    parsed = new URL(proxyUrl);
  } catch {
    console.error('[generateVercelConfig] Invalid RENDER_API_PROXY_URL:', proxyUrl);
    process.exit(1);
  }
  if (!parsed.hostname.endsWith('.onrender.com')) {
    console.error('[generateVercelConfig] Host must be *.onrender.com');
    process.exit(1);
  }
  if (BANNED_PROXY_HOSTS.has(parsed.hostname.toLowerCase())) {
    console.error('[generateVercelConfig] Refusing banned proxy host:', parsed.hostname);
    process.exit(1);
  }
  apiDestination = `${parsed.origin}/api/$1`;
  socketDestination = `${parsed.origin}/socket.io/$1`;
}

if (onVercel && apiDestination.includes('YOUR-RENDER-SERVICE')) {
  console.error('[generateVercelConfig] Refusing placeholder proxy destination on Vercel');
  process.exit(1);
}

const payload = {
  rewrites: template.rewrites.map((rule) => {
    if (rule.source === '/api/(.*)') {
      return { ...rule, destination: apiDestination };
    }
    if (rule.source === '/socket.io/(.*)') {
      return { ...rule, destination: socketDestination };
    }
    return rule;
  }),
  ...(template.buildCommand ? { buildCommand: template.buildCommand } : {}),
  ...(template.installCommand ? { installCommand: template.installCommand } : {}),
};

const targets = [path.join(REPO_ROOT, 'vercel.json'), path.join(CLIENT_ROOT, 'vercel.json')];
for (const file of targets) {
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`[generateVercelConfig] wrote ${path.relative(REPO_ROOT, file)}`);
}

if (proxyUrl) {
  console.log(`[generateVercelConfig] /api rewrite → ${apiDestination.replace('/$1', '')}`);
  console.log(`[generateVercelConfig] /socket.io rewrite → ${socketDestination.replace('/$1', '')}`);
}
