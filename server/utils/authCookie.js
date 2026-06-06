const jwt = require('jsonwebtoken');

/** Current session cookie — sliding inactivity sessions (Jun 2026+). */
const COOKIE_NAME = 'coreknot_token_v3';

/** Prior cookie names — purged on every response so deploy forces fresh login on all devices. */
const LEGACY_COOKIE_NAMES = ['coreknot_token_v2', 'coreknot_token'];

const BUILTIN_FRONTEND_HOSTS = [
  'tsccoreknot.com',
  'www.tsccoreknot.com',
  'taskmaster-sand.vercel.app',
];

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
  return hosts;
};

/** Vercel /api rewrite sets X-Forwarded-Host — use Lax cookies (not None+Partitioned). */
const isFirstPartyProxiedRequest = (req) => {
  if (!req) return false;
  const forwarded = String(
    (typeof req.get === 'function' && req.get('x-forwarded-host'))
    || req.headers?.['x-forwarded-host']
    || '',
  ).split(',')[0].trim().toLowerCase();
  if (!forwarded) return false;
  return frontendHosts().has(forwarded);
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
  isFirstPartyProxiedRequest,
  setAuthCookie,
  clearAuthCookie,
  purgeLegacyAuthCookies,
  hadAuthCookie,
  getTokenFromRequest,
  getUserIdFromToken,
  getCookieOptions,
};
