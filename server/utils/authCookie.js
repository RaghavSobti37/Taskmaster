const jwt = require('jsonwebtoken');
const { isVercelAppHost } = require('./vercelOrigins');

/** Current session cookie — sliding inactivity sessions (Jun 2026+). */
const COOKIE_NAME = 'coreknot_token_v3';

/** Prior cookie names — purged on every response so deploy forces fresh login on all devices. */
const LEGACY_COOKIE_NAMES = ['coreknot_token_v2', 'coreknot_token'];

const BUILTIN_FRONTEND_HOSTS = [
  'tsccoreknot.com',
  'www.tsccoreknot.com',
  'landing.tsccoreknot.com',
  'auth.tsccoreknot.com',
  'theshakticollective.in',
  'www.theshakticollective.in',
  'taskmaster-sand.vercel.app',
];

/** Normalize host: strip port, lowercase, drop leading www for allowlist match. */
const normalizeHost = (raw) => {
  const value = String(raw || '').split(',')[0].trim().toLowerCase();
  if (!value) return '';
  const withoutPort = value.replace(/:\d+$/, '');
  try {
    if (withoutPort.includes('://')) {
      return new URL(withoutPort).host.toLowerCase();
    }
  } catch {
    /* fall through */
  }
  return withoutPort;
};

const hostFromHeaderUrl = (raw) => {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  try {
    return new URL(trimmed).host.toLowerCase();
  } catch {
    return normalizeHost(trimmed);
  }
};

const hostsMatchFrontend = (host, allowed) => {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  if (allowed.has(normalized)) return true;
  if (normalized.startsWith('www.')) {
    return allowed.has(normalized.slice(4));
  }
  return allowed.has(`www.${normalized}`);
};

const parseJwtExpiryMs = () => {
  const raw = process.env.JWT_EXPIRES_IN || '7d';
  const match = String(raw).trim().match(/^(\d+)([smhd])$/i);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const n = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return n * (multipliers[unit] || multipliers.d);
};

const frontendHosts = () => {
  const hosts = new Set(BUILTIN_FRONTEND_HOSTS.map((h) => h.toLowerCase()));
  for (const raw of [process.env.FRONTEND_URL, process.env.CLIENT_URL]) {
    if (!raw) continue;
    try {
      hosts.add(new URL(raw).host.toLowerCase());
    } catch {
      /* ignore */
    }
  }
  for (const raw of (process.env.CORS_ALLOWED_ORIGINS || '').split(',')) {
    if (!raw.trim()) continue;
    try {
      hosts.add(new URL(raw.trim()).host.toLowerCase());
    } catch {
      /* ignore */
    }
  }
  return hosts;
};

const readHeader = (req, name) => {
  if (!req) return '';
  if (typeof req.get === 'function') return req.get(name) || '';
  const key = name.toLowerCase();
  return req.headers?.[key] || req.headers?.[name] || '';
};

/** Share session across tsccoreknot.com subdomains (app, landing, auth). */
const getSharedCookieDomain = (req) => {
  if (process.env.NODE_ENV !== 'production') return undefined;
  const host = normalizeHost(readHeader(req, 'x-forwarded-host') || readHeader(req, 'host'));
  if (!host) return undefined;
  if (host === 'tsccoreknot.com' || host.endsWith('.tsccoreknot.com')) {
    return '.tsccoreknot.com';
  }
  return undefined;
};

/** Vercel /api rewrite sets X-Forwarded-Host — use Lax cookies (not None+Partitioned). */
const isFirstPartyProxiedRequest = (req) => {
  if (!req) return false;
  const allowed = frontendHosts();

  const forwardedHost = normalizeHost(readHeader(req, 'x-forwarded-host'));
  if (forwardedHost && hostsMatchFrontend(forwardedHost, allowed)) {
    return true;
  }
  if (forwardedHost && isVercelAppHost(forwardedHost)) {
    return true;
  }

  const apiHost = normalizeHost(readHeader(req, 'host'));
  const proxiedViaRender = apiHost.endsWith('.onrender.com');
  if (proxiedViaRender) {
    for (const headerName of ['origin', 'referer']) {
      const headerHost = hostFromHeaderUrl(readHeader(req, headerName));
      if (headerHost && hostsMatchFrontend(headerHost, allowed)) {
        return true;
      }
    }
  }

  return false;
};

const getCookieOptions = (req) => {
  const isProd = process.env.NODE_ENV === 'production';
  const firstParty = isFirstPartyProxiedRequest(req);
  const options = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd && !firstParty ? 'none' : 'lax',
    maxAge: parseJwtExpiryMs(),
    path: '/',
  };
  const domain = getSharedCookieDomain(req);
  if (domain) options.domain = domain;
  if (isProd && !firstParty) {
    options.partitioned = true;
  }
  return options;
};

const clearCookieVariants = (res, name, req) => {
  const variants = [
    { ...getCookieOptions(req), maxAge: 0 },
    { path: '/', httpOnly: true, secure: false, sameSite: 'lax', maxAge: 0 },
    { path: '/', httpOnly: true, secure: true, sameSite: 'none', maxAge: 0 },
    {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      partitioned: true,
      maxAge: 0,
    },
  ];
  for (const opts of variants) {
    res.clearCookie(name, opts);
  }
};

const purgeLegacyAuthCookies = (res, req) => {
  for (const name of LEGACY_COOKIE_NAMES) {
    clearCookieVariants(res, name, req);
  }
};

const setAuthCookie = (res, token, req) => {
  if (!isFirstPartyProxiedRequest(req)) {
    purgeLegacyAuthCookies(res, req);
  }
  res.cookie(COOKIE_NAME, token, getCookieOptions(req));
};

/** Wipe all cookie variants before issuing a fresh session (fixes iOS stale SameSite conflicts). */
const replaceAuthCookie = (res, token, req) => {
  clearCookieVariants(res, COOKIE_NAME, req);
  purgeLegacyAuthCookies(res, req);
  setAuthCookie(res, token, req);
};

const clearAuthCookie = (res, req) => {
  clearCookieVariants(res, COOKIE_NAME, req);
  purgeLegacyAuthCookies(res, req);
};

const hadAuthCookie = (req) =>
  Boolean(req.cookies?.[COOKIE_NAME])
  || LEGACY_COOKIE_NAMES.some((name) => Boolean(req.cookies?.[name]));

const getTokenFromRequest = (req) => {
  if (req.cookies?.[COOKIE_NAME]) {
    return req.cookies[COOKIE_NAME];
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  return null;
};

const getUserIdFromToken = (token) => {
  if (!token || !process.env.JWT_SECRET) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.id || null;
  } catch {
    return null;
  }
};

module.exports = {
  COOKIE_NAME,
  LEGACY_COOKIE_NAMES,
  normalizeHost,
  frontendHosts,
  isFirstPartyProxiedRequest,
  setAuthCookie,
  replaceAuthCookie,
  clearAuthCookie,
  purgeLegacyAuthCookies,
  hadAuthCookie,
  getTokenFromRequest,
  getUserIdFromToken,
  getCookieOptions,
};
