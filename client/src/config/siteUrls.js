import { isAppSite, isAuthSite, isLandingSite } from './siteMode';

const trimSlash = (url) => String(url || '').replace(/\/$/, '');

export const LANDING_ORIGIN = trimSlash(
  import.meta.env.VITE_LANDING_URL || 'https://landing.tsccoreknot.com',
);
export const AUTH_ORIGIN = trimSlash(
  import.meta.env.VITE_AUTH_URL || 'https://auth.tsccoreknot.com',
);
export const APP_ORIGIN = trimSlash(
  import.meta.env.VITE_APP_URL || 'https://tsccoreknot.com',
);

const joinOrigin = (origin, path = '/') => {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${clean === '/' ? '' : clean}`;
};

export const landingUrl = (path = '/') => joinOrigin(LANDING_ORIGIN, path);
export const authUrl = (path = '/login') => joinOrigin(AUTH_ORIGIN, path);
export const appUrl = (path = '/dashboard') => joinOrigin(APP_ORIGIN, path);

/** Post-login / deep links: auth subdomain → full app URL */
export const resolveAppNavigationTarget = (pathOrUrl) => {
  if (!pathOrUrl) return appUrl('/dashboard');
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (pathOrUrl.startsWith('/') && (isAuthSite() || isLandingSite())) {
    return appUrl(pathOrUrl);
  }
  return pathOrUrl;
};

export const marketingLinkTarget = (path) => {
  if (isLandingSite() && path.startsWith('/login')) return authUrl(path);
  if (isLandingSite() && path.startsWith('/register')) return authUrl(path);
  if (isAppSite()) return authUrl(path);
  return path;
};

export const shouldRedirectMarketingRoute = (pathname) => {
  if (!isAppSite()) return null;
  const authSlugs = new Set([
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/relegends',
    '/auth/google/success',
  ]);
  if (pathname === '/') return landingUrl('/');
  if (authSlugs.has(pathname)) return authUrl(pathname);
  return null;
};

export { isAppSite, isAuthSite, isLandingSite } from './siteMode';
