const jwt = require('jsonwebtoken');

/** Current session cookie (Jun 2026+). */
const COOKIE_NAME = 'coreknot_token_v2';

/** Pre-fix cookie names — purged on every response after deploy so logout works for existing users. */
const LEGACY_COOKIE_NAMES = ['coreknot_token'];

const parseJwtExpiryMs = () => {
  const raw = process.env.JWT_EXPIRES_IN || '7d';
  const match = String(raw).trim().match(/^(\d+)([smhd])$/i);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const n = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return n * (multipliers[unit] || multipliers.d);
};

const getCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';
  const options = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: parseJwtExpiryMs(),
    path: '/',
  };
  if (isProd) {
    options.partitioned = true;
  }
  return options;
};

const clearCookieVariants = (res, name) => {
  const expired = new Date(0);
  const variants = [
    { ...getCookieOptions(), maxAge: 0, expires: expired },
    { path: '/', httpOnly: true, secure: false, sameSite: 'lax', maxAge: 0, expires: expired },
    { path: '/', httpOnly: true, secure: true, sameSite: 'none', maxAge: 0, expires: expired },
    {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      partitioned: true,
      maxAge: 0,
      expires: expired,
    },
  ];
  for (const opts of variants) {
    res.clearCookie(name, opts);
  }
};

/** Strip legacy cookies on every response (one deploy clears all stuck sessions). */
const purgeLegacyAuthCookies = (res) => {
  for (const name of LEGACY_COOKIE_NAMES) {
    clearCookieVariants(res, name);
  }
};

const setAuthCookie = (res, token) => {
  purgeLegacyAuthCookies(res);
  res.cookie(COOKIE_NAME, token, getCookieOptions());
};

const clearAuthCookie = (res) => {
  clearCookieVariants(res, COOKIE_NAME);
  purgeLegacyAuthCookies(res);
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
  setAuthCookie,
  clearAuthCookie,
  purgeLegacyAuthCookies,
  hadAuthCookie,
  getTokenFromRequest,
  getUserIdFromToken,
  getCookieOptions,
};
