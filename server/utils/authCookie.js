const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'coreknot_token';

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
  // Safari cross-site (Vercel frontend + Render API) needs CHIPS-style partitioning
  if (isProd) {
    options.partitioned = true;
  }
  return options;
};

const setAuthCookie = (res, token) => {
  res.cookie(COOKIE_NAME, token, getCookieOptions());
};

const clearAuthCookie = (res) => {
  res.clearCookie(COKIE_NAME, { ...getCookieOptions(), maxAge: 0 });
};

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
  setAuthCookie,
  clearAuthCookie,
  getTokenFromRequest,
  getUserIdFromToken,
  getCookieOptions,
};
