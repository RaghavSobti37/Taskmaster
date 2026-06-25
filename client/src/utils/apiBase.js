import { shouldUseSameOriginApi } from './displayMode';

/** API origin for OAuth redirects and absolute URLs. Empty = same-origin / Vite proxy. */
export function getApiBaseUrl() {
  return (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
}

/** Vite dev server always proxies /api and /socket.io to localhost:5000. */
export function isViteProxyDev() {
  return import.meta.env.DEV;
}

/** Direct API origin when not using same-origin proxy. */
export function getDirectApiBaseUrl() {
  if (isViteProxyDev()) return undefined;
  return getApiBaseUrl() || undefined;
}

/** Dev + mobile/PWA: Vite/Vercel proxy. Desktop production: Render direct (skips Vercel edge). */
export function routeViaSameOriginApi() {
  if (import.meta.env.DEV) return true;
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
