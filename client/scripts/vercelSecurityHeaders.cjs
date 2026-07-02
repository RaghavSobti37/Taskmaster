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

/** Shared security headers for Vercel static SPA deployments. */
const VERCEL_SECURITY_HEADERS = [
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
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com https://us-assets.i.posthog.com https://eu-assets.i.posthog.com "
        + `${CLERK_SCRIPT_ORIGINS} ${GOOGLE_AUTH_ORIGINS}`,
      `style-src 'self' 'unsafe-inline' ${GOOGLE_AUTH_ORIGINS}`,
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      `frame-src https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com ${GOOGLE_AUTH_ORIGINS}`,
      "worker-src 'self' blob:",
    ].join('; '),
  },
];

const CACHE_NO_STORE = {
  key: 'Cache-Control',
  value: 'no-cache, no-store, must-revalidate',
};

/** Merge security headers with optional per-route headers (e.g. Cache-Control). */
function buildVercelHeaders(templateHeaders = []) {
  const securityBlock = {
    source: '/(.*)',
    headers: VERCEL_SECURITY_HEADERS,
  };

  const existing = Array.isArray(templateHeaders) ? [...templateHeaders] : [];
  const hasCatchAll = existing.some((block) => block.source === '/(.*)');
  if (hasCatchAll) return existing;

  return [securityBlock, ...existing];
}

module.exports = {
  VERCEL_SECURITY_HEADERS,
  CACHE_NO_STORE,
  buildVercelHeaders,
};
