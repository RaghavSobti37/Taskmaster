import { isAppSite, isAuthSite, isLandingSite } from './siteMode';

const PROD_APP_ORIGIN = 'https://tsccoreknot.com';

const trimSlash = (url) => String(url || '').replace(/\/$/, '');

const browserOrigin = () => {
  if (typeof window === 'undefined' || !window.location?.origin) return null;
  return trimSlash(window.location.origin);
};

const hostFromUrl = (url) => {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return '';
  }
};

/** App host serves workspace routes (prod: tsccoreknot.com).
 * Auth site never falls back to its own origin here — split deploy means
 * auth.tsccoreknot.com is not the app host, so an unset VITE_APP_URL must
 * resolve to the real prod app origin, not the auth subdomain. */
export function getAppOrigin() {
  if (import.meta.env.VITE_APP_URL) return trimSlash(import.meta.env.VITE_APP_URL);
  if (isAppSite() && browserOrigin()) return browserOrigin();
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

/** Split deploy: auth on auth.tsccoreknot.com while app stays on tsccoreknot.com. */
export const usesExternalAuthHost = () => {
  if (!isAppSite() && !isLandingSite()) return false;
  const configured = import.meta.env.VITE_AUTH_URL?.trim();
  if (!configured) return false;
  const appHost = hostFromUrl(getAppOrigin());
  const authHost = hostFromUrl(configured);
  return Boolean(appHost && authHost && appHost !== authHost);
};

/** Split deploy: marketing on landing.tsccoreknot.com. */
export const usesExternalLandingHost = () => {
  if (!isAppSite()) return false;
  const configured = import.meta.env.VITE_LANDING_URL?.trim();
  if (!configured) return false;
  const appHost = hostFromUrl(getAppOrigin());
  const landingHost = hostFromUrl(configured);
  return Boolean(appHost && landingHost && appHost !== landingHost);
};

const AUTH_ROUTE_PATHS = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/relegends',
  '/auth/google/success',
]);

/** App host → external auth subdomain (keeps query string e.g. ?ticket=). */
export const externalAuthRedirectTarget = (pathname, search = '') => {
  if (!usesExternalAuthHost() || !AUTH_ROUTE_PATHS.has(pathname)) return null;
  return `${authUrl(pathname)}${search || ''}`;
};

const joinOrigin = (origin, path = '/') => {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${clean === '/' ? '' : clean}`;
};

export const landingUrl = (path = '/') => joinOrigin(getLandingOrigin(), path);
export const authUrl = (path = '/login') => joinOrigin(getAuthOrigin(), path);
export const appUrl = (path = '/dashboard') => joinOrigin(getAppOrigin(), path);

/**
 * Clerk force-redirect after sign-in. Auth subdomain must stay on /login until
 * clerk-establish sets the shared cookie — app dashboard URL too early = login loop.
 */
export const resolveClerkForceRedirectUrl = () => {
  if (isAuthSite()) return '/login';
  return '/dashboard';
};

/**
 * Clerk `forceRedirectUrl` to `/login` on the auth host breaks Client Trust
 * (`/login/client-trust`) — Clerk shows cl-spinner forever. LoginPage owns
 * post-establish navigation on auth.tsccoreknot.com.
 */
export function getClerkSignInRedirectProps() {
  if (isAuthSite()) return {};
  const url = resolveClerkForceRedirectUrl();
  return { fallbackRedirectUrl: url, forceRedirectUrl: url };
}

export function getClerkProviderRedirectProps() {
  if (isAuthSite()) return {};
  const url = resolveClerkForceRedirectUrl();
  return {
    signInForceRedirectUrl: url,
    signUpForceRedirectUrl: url,
  };
}

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
  if (pathname === '/' && usesExternalLandingHost()) return landingUrl('/');
  if (pathname === '/landing' && usesExternalLandingHost()) return landingUrl('/');
  return null;
};

export { isAppSite, isAuthSite, isLandingSite } from './siteMode';
