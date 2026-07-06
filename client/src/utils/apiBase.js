import { isVercelPreviewHost, shouldUseSameOriginApi } from './displayMode';
import { isAppSite, isAuthSite } from '../config/siteMode';
import { usesExternalAuthHost } from '../config/siteUrls';
import { isLocalViteDev } from './runtimeEnv';

/** API origin for OAuth redirects and absolute URLs. Empty = same-origin / Vite proxy. */
export function getApiBaseUrl() {
  return (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
}

/** Local Vite dev only — production hosts never proxy via this path. */
export function isViteProxyDev() {
  return isLocalViteDev();
}

/** Direct API origin when not using same-origin proxy. */
export function getDirectApiBaseUrl() {
  if (isViteProxyDev()) return undefined;
  return getApiBaseUrl() || undefined;
}

/** Dev + mobile/PWA: Vite/Vercel proxy. Desktop production: Render direct (skips Vercel edge).
 * Auth host always same-origin — clerk-establish/session cookies must not cross origins (CORS).
 * Split deploy (auth.tsccoreknot.com): app host must proxy /api too — clerk-establish sets
 * SameSite=Lax on .tsccoreknot.com via proxy; direct Render skips the cookie → login loop.
 * Vercel preview: direct staging API — Deployment Protection SSO blocks /api rewrites. */
export function routeViaSameOriginApi() {
  if (isLocalViteDev()) return true;
  if (isAuthSite()) return true;
  if (isAppSite() && usesExternalAuthHost()) return true;
  if (typeof window !== 'undefined' && isVercelPreviewHost()) return false;
  if (typeof window !== 'undefined' && shouldUseSameOriginApi()) return true;
  return false;
}

/** Axios base URL: undefined = relative paths via Vite/Vercel proxy. */
export function getAxiosBaseURL() {
  if (routeViaSameOriginApi()) return undefined;
  const apiBase = getApiBaseUrl();
  if (import.meta.env.PROD && apiBase) return apiBase;
  return undefined;
}

/** Socket.io origin — direct Render API in production (Vercel rewrites cannot proxy WebSocket). */
export function getRealtimeOrigin() {
  if (typeof window === 'undefined') return '';
  if (isViteProxyDev()) return window.location.origin;
  const apiBase = getApiBaseUrl();
  if (import.meta.env.PROD && apiBase) return apiBase;
  return window.location.origin;
}

/** True when Socket.io must use handshake auth (cross-origin vs page). */
export function isCrossOriginRealtime() {
  if (typeof window === 'undefined') return false;
  const realtimeOrigin = getRealtimeOrigin();
  if (!realtimeOrigin) return false;
  try {
    return new URL(realtimeOrigin).origin !== window.location.origin;
  } catch {
    return false;
  }
}

/** Build API path — relative on proxy routes; absolute Render URL on desktop production. */
export function apiPath(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (routeViaSameOriginApi()) return normalized;
  const base = getApiBaseUrl();
  return base ? `${base}${normalized}` : normalized;
}
