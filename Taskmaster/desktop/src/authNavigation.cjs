const APP_ORIGIN = 'https://tsccoreknot.com';
const AUTH_ORIGIN = 'https://auth.tsccoreknot.com';

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isCoreKnotHost(hostname) {
  return hostname === 'tsccoreknot.com' || hostname === 'www.tsccoreknot.com';
}

function isAuthHost(hostname) {
  return hostname === 'auth.tsccoreknot.com';
}

function isAuthPath(pathname) {
  return pathname === '/login'
    || pathname.startsWith('/login/')
    || pathname === '/register'
    || pathname === '/forgot-password'
    || pathname === '/reset-password'
    || pathname === '/relegends';
}

function toAuthUrl(value) {
  const url = parseUrl(value);
  if (!url) return `${AUTH_ORIGIN}/login`;
  if (isAuthHost(url.hostname)) return url.toString();
  if (isCoreKnotHost(url.hostname) && isAuthPath(url.pathname)) {
    return `${AUTH_ORIGIN}${url.pathname}${url.search}${url.hash}`;
  }
  return `${AUTH_ORIGIN}/login`;
}

function shouldOpenAuthPopup(value) {
  const url = parseUrl(value);
  if (!url) return false;
  return isAuthHost(url.hostname) || (isCoreKnotHost(url.hostname) && isAuthPath(url.pathname));
}

function isCoreKnotAppReturn(value) {
  const url = parseUrl(value);
  if (!url) return false;
  return isCoreKnotHost(url.hostname) && !isAuthPath(url.pathname);
}

module.exports = {
  APP_ORIGIN,
  AUTH_ORIGIN,
  isCoreKnotAppReturn,
  shouldOpenAuthPopup,
  toAuthUrl,
};
