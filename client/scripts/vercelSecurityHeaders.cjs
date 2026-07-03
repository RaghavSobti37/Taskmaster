/** CoreKnot production hosts — clerk-js on satellites may load via app origin rewrite. */
const CLERK_SCRIPT_ORIGINS = [
  'https://tsccoreknot.com',
  'https://www.tsccoreknot.com',
  'https://auth.tsccoreknot.com',
  'https://landing.tsccoreknot.com',
].join(' ');

/** Google Identity Services + OAuth popups (Clerk social sign-in). */
const GOOGLE_AUTH_ORIGINS = [
  'https://accounts.google.com',
  'https://*.google.com',
].join(' ');

/** Vercel Preview toolbar + SSO manifest (harmless on prod if present). */
const VERCEL_PREVIEW_ORIGINS = [
  'https://vercel.live',
  'https://vercel.com',
  'https://*.vercel.app',
].join(' ');

const buildContentSecurityPolicy = ({ isPreview = false } = {}) => {
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    'https://*.clerk.accounts.dev',
    'https://*.clerk.com',
    'https://challenges.cloudflare.com',
    'https://us-assets.i.posthog.com',
    'https://eu-assets.i.posthog.com',
    CLERK_SCRIPT_ORIGINS,
    GOOGLE_AUTH_ORIGINS,
    ...(isPreview ? ['https://vercel.live'] : []),
  ].join(' ');

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline' ${GOOGLE_AUTH_ORIGINS}`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https: wss:",
    `frame-src https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com ${GOOGLE_AUTH_ORIGINS}`,
    "worker-src 'self' blob:",
  ];

  if (isPreview) {
    directives.push(`manifest-src 'self' ${VERCEL_PREVIEW_ORIGINS}`);
  }

  return directives.join('; ');
};

/** Shared security headers for Vercel static SPA deployments. */
const buildVercelSecurityHeaders = ({ isPreview = false } = {}) => [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'Content-Security-Policy',
    value: buildContentSecurityPolicy({ isPreview }),
  },
];

/** @deprecated use buildVercelSecurityHeaders — kept for tests importing VERCEL_SECURITY_HEADERS */
const VERCEL_SECURITY_HEADERS = buildVercelSecurityHeaders();

const CACHE_NO_STORE = {
  key: 'Cache-Control',
  value: 'no-cache, no-store, must-revalidate',
};

/** Merge security headers with optional per-route headers (e.g. Cache-Control). */
function buildVercelHeaders(templateHeaders = [], options = {}) {
  const securityBlock = {
    source: '/(.*)',
    headers: buildVercelSecurityHeaders(options),
  };

  const existing = Array.isArray(templateHeaders) ? [...templateHeaders] : [];
  const catchAllIdx = existing.findIndex((block) => block.source === '/(.*)');
  if (catchAllIdx >= 0) {
    const merged = [...existing];
    merged[catchAllIdx] = securityBlock;
    return merged;
  }

  return [securityBlock, ...existing];
}

module.exports = {
  VERCEL_SECURITY_HEADERS,
  CACHE_NO_STORE,
  buildVercelHeaders,
  buildVercelSecurityHeaders,
  buildContentSecurityPolicy,
};
