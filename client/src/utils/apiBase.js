import { shouldUseSameOriginApi } from './displayMode';
import { isApiProxyHealthy, shouldFallbackToDirectApi } from './apiProxyHealth';

const LOCAL_API_RE = /^https?:\/\/(localhost|127\.0\.0\.1):5000\/?$/i;

/** API origin for auth redirects (OAuth) and absolute URLs. Empty = same-origin / Vite proxy. */
export function getApiBaseUrl() {
  return (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
}

/** In dev, localhost:5000 in .env still uses Vite proxy (/api, /socket.io) to avoid CORS and port races. */
export function isViteProxyDev() {
  return import.meta.env.DEV && LOCAL_API_RE.test(getApiBaseUrl());
}

/** Direct Render API — large payloads that exceed Vercel's ~4.5MB proxy limit. */
export function getDirectApiBaseUrl() {
  if (isViteProxyDev()) return undefined;
  return getApiBaseUrl() || undefined;
}

const routeViaSameOriginApi = () => {
  if (isViteProxyDev()) return true;
  if (!shouldUseSameOriginApi()) return false;
  if (shouldFallbackToDirectApi()) return false;
  if (isApiProxyHealthy() === false) return false;
  return true;
};

/** Axios base URL: undefined = relative paths via Vite/Vercel proxy. */
export function getAxiosBaseURL() {
  if (routeViaSameOriginApi()) return undefined;
  return getDirectApiBaseUrl();
}

/** Socket.io origin (Vite proxy supports ws in dev). */
export function getRealtimeOrigin() {
  if (typeof window === 'undefined') return '';
  if (isViteProxyDev()) return window.location.origin;
  return getDirectApiBaseUrl() || window.location.origin;
}

/** Build API path; mobile/PWA prefer same-origin /api when proxy is healthy. */
export function apiPath(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (routeViaSameOriginApi()) return normalized;
  const base = getDirectApiBaseUrl();
  return base ? `${base}${normalized}` : normalized;
}
