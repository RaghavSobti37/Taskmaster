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

const readLocalNestApiUrl = () => {
  const localHosts = path.join(REPO_ROOT, '.cursor', 'production-hosts.local.json');
  if (!fs.existsSync(localHosts)) return '';
  try {
    const json = JSON.parse(fs.readFileSync(localHosts, 'utf8'));
    return String(
      json.stagingNestApiUrl
      || json.derived?.stagingNestApiUrl
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

const pickNestProxyUrl = () => {
  const candidates = [
    process.env.NEST_API_PROXY_URL,
    readLocalNestApiUrl(),
  ].map(normalizeProxyUrl).filter(Boolean);

  for (const url of candidates) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (!BANNED_PROXY_HOSTS.has(host)) return url;
      console.warn(`[generateVercelConfig] skipping banned Nest proxy host: ${host}`);
    } catch {
      /* ignore */
    }
  }
  return '';
};

const readExistingClientVercelJson = () => {
  try {
    return JSON.parse(fs.readFileSync(path.join(CLIENT_ROOT, 'vercel.json'), 'utf8'));
  } catch {
    return null;
  }
};

const existingRewritesLookValid = (existing) => {
  const apiRule = existing?.rewrites?.find((rule) => rule.source === '/api/(.*)');
  const dest = String(apiRule?.destination || '');
  if (!dest.includes('.onrender.com') || dest.includes('YOUR-RENDER-SERVICE')) return false;
  try {
    const host = new URL(dest.replace('/$1', '/')).hostname.toLowerCase();
    return !BANNED_PROXY_HOSTS.has(host);
  } catch {
    return false;
  }
};

const proxyUrl = pickProxyUrl();
const nestProxyUrl = pickNestProxyUrl();
const onVercel = process.env.VERCEL === '1';

if (onVercel && !proxyUrl) {
  const existing = readExistingClientVercelJson();
  if (existingRewritesLookValid(existing)) {
    console.warn(
      '[generateVercelConfig] RENDER_API_PROXY_URL unset on Vercel — keeping committed client/vercel.json rewrites',
    );
    process.exit(0);
  }
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

let nestAttendanceDestination = '';
if (nestProxyUrl) {
  try {
    const nestParsed = new URL(nestProxyUrl);
    if (!nestParsed.hostname.endsWith('.onrender.com')) {
      console.error('[generateVercelConfig] NEST_API_PROXY_URL host must be *.onrender.com');
      process.exit(1);
    }
    nestAttendanceDestination = `${nestParsed.origin}/api/attendance`;
  } catch {
    console.error('[generateVercelConfig] Invalid NEST_API_PROXY_URL:', nestProxyUrl);
    process.exit(1);
  }
}

if (onVercel && apiDestination.includes('YOUR-RENDER-SERVICE')) {
  console.error('[generateVercelConfig] Refusing placeholder proxy destination on Vercel');
  process.exit(1);
}

const payload = {
  ...(template.redirects ? { redirects: template.redirects } : {}),
  rewrites: [
    ...(nestAttendanceDestination
      ? [
          {
            source: '/api/attendance',
            destination: nestAttendanceDestination,
          },
          {
            source: '/api/attendance/:path*',
            destination: `${nestAttendanceDestination}/:path*`,
          },
        ]
      : []),
    ...template.rewrites.map((rule) => {
    if (rule.source === '/api/(.*)') {
      return { ...rule, destination: apiDestination };
    }
    if (rule.source === '/socket.io/(.*)') {
      return { ...rule, destination: socketDestination };
    }
    return rule;
  }),
  ],
  ...(template.buildCommand ? { buildCommand: template.buildCommand } : {}),
  ...(template.installCommand ? { installCommand: template.installCommand } : {}),
  ...(template.env ? { env: template.env } : {}),
};

const targets = [path.join(REPO_ROOT, 'vercel.json'), path.join(CLIENT_ROOT, 'vercel.json')];
const payloadText = `${JSON.stringify(payload, null, 2)}\n`;
for (const file of targets) {
  let existing = '';
  try {
    existing = fs.readFileSync(file, 'utf8');
  } catch {
    /* new file */
  }
  if (existing === payloadText) {
    console.log(`[generateVercelConfig] unchanged ${path.relative(REPO_ROOT, file)}`);
    continue;
  }
  fs.writeFileSync(file, payloadText, 'utf8');
  console.log(`[generateVercelConfig] wrote ${path.relative(REPO_ROOT, file)}`);
}

if (proxyUrl) {
  console.log(`[generateVercelConfig] /api rewrite → ${apiDestination.replace('/$1', '')}`);
  console.log(`[generateVercelConfig] /socket.io rewrite → ${socketDestination.replace('/$1', '')}`);
}
if (nestAttendanceDestination) {
  console.log(`[generateVercelConfig] /api/attendance strangler → ${nestAttendanceDestination}`);
}
