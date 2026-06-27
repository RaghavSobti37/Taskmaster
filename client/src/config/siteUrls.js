import { isAppSite, isAuthSite, isLandingSite } from './siteMode';

const trimSlash = (url) => String(url || '').replace(/\/$/, '');

export const APP_ORIGIN = trimSlash(
  import.meta.env.VITE_APP_URL || 'https://tsccoreknot.com',
);
/** Path-based landing on main app host (override with VITE_LANDING_URL for legacy subdomain). */
export const LANDING_ORIGIN = trimSlash(
  import.meta.env.VITE_LANDING_URL || `${APP_ORIGIN}/landing`,
);
/** Auth routes live on the main app host (e.g. /login), not a separate subdomain. */
export const AUTH_ORIGIN = trimSlash(import.meta.env.VITE_AUTH_URL || APP_ORIGIN);

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
  if (
    isLandingSite()
    && (path.startsWith('/login') || path.startsWith('/register') || path.startsWith('/forgot-password'))
  ) {
    return authUrl(path);
  }
  return path;
};

export const shouldRedirectMarketingRoute = (pathname) => {
  if (!isAppSite()) return null;
  if (pathname === '/') return landingUrl('/');
  return null;
};

export { isAppSite, isAuthSite, isLandingSite } from './siteMode';
