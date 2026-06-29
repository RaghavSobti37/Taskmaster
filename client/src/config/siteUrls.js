import { isAppSite, isAuthSite, isLandingSite } from './siteMode';

const PROD_APP_ORIGIN = 'https://tsccoreknot.com';

const trimSlash = (url) => String(url || '').replace(/\/$/, '');

const browserOrigin = () => {
  if (typeof window === 'undefined' || !window.location?.origin) return null;
  return trimSlash(window.location.origin);
};

/** App host serves workspace routes (prod: tsccoreknot.com). */
export function getAppOrigin() {
  if (import.meta.env.VITE_APP_URL) return trimSlash(import.meta.env.VITE_APP_URL);
  if ((isAppSite() || isAuthSite()) && browserOrigin()) return browserOrigin();
  return PROD_APP_ORIGIN;
}

/** Auth routes on app host in app mode; separate auth subdomain in split deploy. */
export function getAuthOrigin() {
  if (import.meta.env.VITE_AUTH_URL) return trimSlash(import.meta.env.VITE_AUTH_URL);
  if ((isAppSite() || isAuthSite()) && browserOrigin()) return browserOrigin();
  return getAppOrigin();
}

/** Marketing landing — path on app host or legacy subdomain. */
export function getLandingOrigin() {
  if (import.meta.env.VITE_LANDING_URL) return trimSlash(import.meta.env.VITE_LANDING_URL);
  if (isLandingSite() && browserOrigin()) return browserOrigin();
  return `${getAppOrigin()}/landing`;
}

/** Login/register live on the same SPA as the app (not a cross-origin hop). */
export const hasSameOriginAuthRoutes = () => isAppSite() || isAuthSite();

const joinOrigin = (origin, path = '/') => {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${clean === '/' ? '' : clean}`;
};

export const landingUrl = (path = '/') => joinOrigin(getLandingOrigin(), path);
export const authUrl = (path = '/login') => joinOrigin(getAuthOrigin(), path);
export const appUrl = (path = '/dashboard') => joinOrigin(getAppOrigin(), path);

/** Post-login / deep links: auth or landing subdomain → full app URL */
export const resolveAppNavigationTarget = (pathOrUrl) => {
  if (!pathOrUrl) {
    return hasSameOriginAuthRoutes() ? '/dashboard' : appUrl('/dashboard');
  }
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
