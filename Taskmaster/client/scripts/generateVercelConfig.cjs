#!/usr/bin/env node
/**
 * Writes vercel.json /api rewrites from RENDER_API_PROXY_URL at build time.
 * Lives under client/scripts (.cjs) so Vercel Root Directory builds stay self-contained.
 */
const fs = require('fs');
const path = require('path');
const { buildVercelHeaders } = require('./vercelSecurityHeaders.cjs');

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

const DEFAULT_STAGING_API_URL = 'https://coreknot-api-staging.onrender.com';

const readLocalStagingApiUrl = () => {
  const localHosts = path.join(REPO_ROOT, '.cursor', 'production-hosts.local.json');
  if (!fs.existsSync(localHosts)) return DEFAULT_STAGING_API_URL;
  try {
    const json = JSON.parse(fs.readFileSync(localHosts, 'utf8'));
    const url = String(
      json.stagingApiUrl
      || json.derived?.stagingApiUrl
      || '',
    ).trim().replace(/\/$/, '');
    return url || DEFAULT_STAGING_API_URL;
  } catch {
    return DEFAULT_STAGING_API_URL;
  }
};

/** Canonical staging API for Vercel preview builds (never production). */
const CANONICAL_STAGING_API_URL = readLocalStagingApiUrl();

const PROD_RENDER_API_SUFFIX = `${['taskmaster', 'jfw0'].join('-')}.onrender.com`;

const isProductionRenderApiHost = (hostname) => {
  const host = String(hostname || '').toLowerCase();
  return host === PROD_RENDER_API_SUFFIX || host === 'coreknot-api.onrender.com';
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

/** Dev branch → Render only; no Vercel preview/production deploy on push. */
const GIT_DEPLOYMENT_CONFIG = {
  git: {
    deploymentEnabled: {
      dev: false,
    },
  },
};

const POSTHOG_PROXY_PREFIX = '/ph';
/** SPA fallback — must not match /ph/* (PostHog same-origin proxy). */
const SPA_CATCHALL_SOURCE = '/((?!api/)(?!ph/)(?!__clerk/)(?!.*\\.[^/]+$).*)';

const postHogProxyEnabled = () => {
  const flag = String(process.env.VITE_POSTHOG_USE_PROXY || '').trim().toLowerCase();
  return flag === 'true' || flag === '1' || flag === 'yes';
};

const resolvePostHogRegion = (host = '') => (
  String(host).toLowerCase().includes('eu') ? 'eu' : 'us'
);

const isPostHogRewrite = (rule) => String(rule?.source || '').startsWith(`${POSTHOG_PROXY_PREFIX}/`);

const mapTemplateRewrites = (rules, apiDestination, socketDestination) => (
  rules
    .filter((rule) => !isPostHogRewrite(rule))
    .filter((rule) => rule.source !== '/socket.io/(.*)')
    .map((rule) => {
      if (rule.source === '/api/(.*)') {
        return { ...rule, destination: apiDestination };
      }
      if (String(rule.source || '').includes('(?!api/)')) {
        return { ...rule, source: SPA_CATCHALL_SOURCE };
      }
      return rule;
    })
);

/** Clerk FAPI proxy on primary app — forwarded to Render (Vercel api/ breaks monorepo npm install). */
const buildClerkProxyRewriteMainApp = (apiDestination) => {
  const origin = String(apiDestination || '').replace(/\/api\/\$1$/, '');
  if (!origin || !origin.includes('.onrender.com')) return null;
  return { source: '/__clerk/:path*', destination: `${origin}/__clerk/:path*` };
};

/** Auth/landing satellites proxy /__clerk directly to Render (same hop as primary app). */
const buildClerkProxyRewriteSatellite = (apiDestination) => (
  buildClerkProxyRewriteMainApp(apiDestination)
);

/** @deprecated alias */
const buildClerkProxyRewrite = (apiDestination) => buildClerkProxyRewriteMainApp(apiDestination);

const composeRewrites = (templateRewrites, apiDestination, socketDestination, clerkProxy) => {
  const mapped = mapTemplateRewrites(templateRewrites, apiDestination, socketDestination);
  const posthog = postHogProxyEnabled() ? buildPostHogRewrites() : [];
  const clerkRewrite = clerkProxy || buildClerkProxyRewriteMainApp(apiDestination);
  const catchallIdx = mapped.findIndex((rule) => rule.source === SPA_CATCHALL_SOURCE);
  const beforeCatchall = catchallIdx === -1 ? mapped : mapped.slice(0, catchallIdx);
  const afterCatchall = catchallIdx === -1 ? [] : mapped.slice(catchallIdx);
  return [
    ...beforeCatchall,
    ...(clerkRewrite ? [clerkRewrite] : []),
    ...posthog,
    ...afterCatchall,
  ];
};

/**
 * PostHog same-origin proxy — static/array before catch-all (cache headers).
 * Uses `:path(.*)` (not `:path*`) because Vercel's wildcard segment matcher drops the
 * trailing slash on paths like `/ph/decide/` and `/ph/e/`, which PostHog's SDK always
 * sends with a trailing slash — see https://github.com/PostHog/posthog/issues/17596.
 */
const buildPostHogRewrites = () => {
  const region = resolvePostHogRegion(process.env.VITE_POSTHOG_HOST);
  const apiBase = `https://${region}.i.posthog.com`;
  const assetsBase = `https://${region}-assets.i.posthog.com`;
  const prefix = POSTHOG_PROXY_PREFIX;
  return [
    { source: `${prefix}/static/:path(.*)`, destination: `${assetsBase}/static/:path` },
    { source: `${prefix}/array/:path(.*)`, destination: `${assetsBase}/array/:path` },
    { source: `${prefix}/:path(.*)`, destination: `${apiBase}/:path` },
  ];
};

const normalizeProxyUrl = (raw) => String(raw || '').trim().replace(/\/$/, '');

const pickProxyUrl = () => {
  const fromEnv = [
    process.env.RENDER_API_PROXY_URL,
    process.env.VITE_API_URL,
  ].map(normalizeProxyUrl).filter(Boolean);

  const candidates = [...fromEnv, readLocalProductionApiUrl()];

  for (const url of candidates) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (BANNED_PROXY_HOSTS.has(host)) {
        console.warn(`[generateVercelConfig] skipping banned proxy host: ${host}`);
        continue;
      }
      return url;
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
      if (BANNED_PROXY_HOSTS.has(host)) {
        console.warn(`[generateVercelConfig] skipping banned Nest proxy host: ${host}`);
        continue;
      }
      return url;
    } catch {
      /* ignore */
    }
  }
  return '';
};

/**
 * Nest attendance strangler — opt-in only (no separate Nest staging service).
 */
const shouldEnableNestAttendanceStrangler = (nestUrl) => {
  if (!nestUrl) return false;
  const flag = String(process.env.NEST_ATTENDANCE_STRANGLER || '').toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
};

/** Vite embed: Socket.io must bypass Vercel (no WebSocket upgrade on rewrites). */
const shouldForcePreviewStagingViteApi = () => {
  if (process.env.VERCEL_ENV !== 'preview') return false;
  const current = String(process.env.VITE_API_URL || '').trim();
  if (!current) return true;
  try {
    return isProductionRenderApiHost(new URL(current).hostname.toLowerCase());
  } catch {
    return false;
  }
};

const writeViteProductionEnv = (proxyUrl) => {
  const isPreview = process.env.VERCEL_ENV === 'preview';
  const effectiveProxy = proxyUrl || (isPreview ? CANONICAL_STAGING_API_URL : '');
  if (!effectiveProxy) return;

  const forcePreviewStaging = shouldForcePreviewStagingViteApi();
  if (String(process.env.VITE_API_URL || '').trim() && !forcePreviewStaging) {
    console.log('[generateVercelConfig] VITE_API_URL set in env — skip .env.production.local');
    return;
  }
  const envFile = path.join(CLIENT_ROOT, '.env.production.local');
  const content = `# Auto-generated by generateVercelConfig.cjs — gitignored\nVITE_API_URL=${effectiveProxy}\n`;
  let existing = '';
  try {
    existing = fs.readFileSync(envFile, 'utf8');
  } catch {
    /* new file */
  }
  if (existing === content) {
    console.log('[generateVercelConfig] unchanged client/.env.production.local');
    return;
  }
  fs.writeFileSync(envFile, content, 'utf8');
  if (forcePreviewStaging && String(process.env.VITE_API_URL || '').trim()) {
    console.warn(
      `[generateVercelConfig] Preview override: production VITE_API_URL env → ${effectiveProxy} (client/.env.production.local)`,
    );
  } else {
    console.log(`[generateVercelConfig] VITE_API_URL → ${effectiveProxy} (client/.env.production.local)`);
  }
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

const main = () => {
const proxyUrl = pickProxyUrl();
const nestProxyUrl = pickNestProxyUrl();
const onVercel = process.env.VERCEL === '1';

if (!proxyUrl) {
  const existing = readExistingClientVercelJson();
  if (existingRewritesLookValid(existing)) {
    const msg = onVercel
      ? '[generateVercelConfig] RENDER_API_PROXY_URL unset on Vercel — keeping committed client/vercel.json rewrites'
      : '[generateVercelConfig] keeping committed client/vercel.json rewrites (postinstall must not clobber prod proxy)';
    console.warn(msg);
    if (onVercel && process.env.VERCEL_ENV === 'preview') {
      writeViteProductionEnv(CANONICAL_STAGING_API_URL);
    }
    process.exit(0);
  }
  if (onVercel) {
    console.error(
      '[generateVercelConfig] RENDER_API_PROXY_URL required on Vercel — mobile login /api proxy will 404.'
    );
    process.exit(1);
  }
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
if (shouldEnableNestAttendanceStrangler(nestProxyUrl)) {
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
} else if (nestProxyUrl) {
  console.log(
    '[generateVercelConfig] Nest attendance strangler skipped (production or NEST_ATTENDANCE_STRANGLER unset)',
  );
}

writeViteProductionEnv(proxyUrl);

if (onVercel && apiDestination.includes('YOUR-RENDER-SERVICE')) {
  console.error('[generateVercelConfig] Refusing placeholder proxy destination on Vercel');
  process.exit(1);
}

if (onVercel && process.env.VERCEL_ENV === 'production' && !String(process.env.VITE_POSTHOG_PROJECT_TOKEN || '').trim()) {
  console.warn(
    '[generateVercelConfig] VITE_POSTHOG_PROJECT_TOKEN missing on Vercel production — PostHog will not capture until set and redeployed',
  );
}

const payload = {
  ...GIT_DEPLOYMENT_CONFIG,
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
    ...composeRewrites(template.rewrites, apiDestination, socketDestination),
  ],
  ...(template.buildCommand ? { buildCommand: template.buildCommand } : {}),
  ...(template.installCommand ? { installCommand: template.installCommand } : {}),
  ...(template.env ? { env: template.env } : {}),
  headers: buildVercelHeaders(template.headers, {
    isPreview: process.env.VERCEL_ENV === 'preview',
  }),
};

const buildSitePayload = (buildCommand) => {
  const satelliteClerk = buildClerkProxyRewriteSatellite(apiDestination);
  const siteRewrites = composeRewrites(
    template.rewrites,
    apiDestination,
    socketDestination,
    satelliteClerk,
  );
  return {
    ...GIT_DEPLOYMENT_CONFIG,
    buildCommand,
    outputDirectory: '../../client/dist',
    installCommand: 'cd ../.. && HUSKY=0 node client/scripts/generateVercelConfig.cjs && node scripts/vercelInstall.js',
    framework: null,
    ...(template.redirects ? { redirects: template.redirects } : {}),
    rewrites: [
      ...(nestAttendanceDestination
        ? [
            { source: '/api/attendance', destination: nestAttendanceDestination },
            { source: '/api/attendance/:path*', destination: `${nestAttendanceDestination}/:path*` },
          ]
        : []),
      ...siteRewrites,
    ],
    headers: buildVercelHeaders(template.headers, {
      isPreview: process.env.VERCEL_ENV === 'preview',
    }),
    env: template.env || { VERCEL_FORCE_NO_BUILD_CACHE: '1' },
  };
};

const targets = [
  path.join(REPO_ROOT, 'vercel.json'),
  path.join(CLIENT_ROOT, 'vercel.json'),
  path.join(REPO_ROOT, 'sites/landing/vercel.json'),
  path.join(REPO_ROOT, 'sites/auth/vercel.json'),
];

const payloadsByTarget = new Map([
  [path.join(REPO_ROOT, 'vercel.json'), payload],
  [path.join(CLIENT_ROOT, 'vercel.json'), payload],
  [path.join(REPO_ROOT, 'sites/landing/vercel.json'), buildSitePayload('cd ../../client && npm run vercel-build:landing')],
  [path.join(REPO_ROOT, 'sites/auth/vercel.json'), buildSitePayload('cd ../../client && npm run vercel-build:auth')],
]);

for (const file of targets) {
  const filePayload = payloadsByTarget.get(file);
  const payloadText = `${JSON.stringify(filePayload, null, 2)}\n`;
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
  if (postHogProxyEnabled()) {
    console.log('[generateVercelConfig] PostHog /ph proxy enabled (VITE_POSTHOG_USE_PROXY)');
  }
}
if (nestAttendanceDestination) {
  console.log(`[generateVercelConfig] /api/attendance strangler → ${nestAttendanceDestination}`);
}
};

module.exports = {
  GIT_DEPLOYMENT_CONFIG,
  SPA_CATCHALL_SOURCE,
  composeRewrites,
  buildPostHogRewrites,
  postHogProxyEnabled,
  buildClerkProxyRewrite,
  buildClerkProxyRewriteMainApp,
  buildClerkProxyRewriteSatellite,
  mapTemplateRewrites,
  existingRewritesLookValid,
  buildVercelHeaders,
  pickProxyUrl,
  writeViteProductionEnv,
  isProductionRenderApiHost,
  CANONICAL_STAGING_API_URL,
  readLocalStagingApiUrl,
};

if (require.main === module) {
  main();
}
