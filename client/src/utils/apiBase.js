import { shouldUseSameOriginApi } from './displayMode';

const LOCAL_API_RE = /^https?:\/\/(localhost|127\.0\.0\.1):5000\/?$/i;

/** API origin for auth redirects (OAuth) and absolute URLs. Empty = same-origin / Vite proxy. */
export function getApiBaseUrl() {
  return (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
}

/** In dev, localhost:5000 in .env still uses Vite proxy (/api, /socket.io) to avoid CORS and port races. */
export function useViteProxyInDev() {
  return import.meta.env.DEV && LOCAL_API_RE.test(getApiBaseUrl());
}

/** Direct Render API — large payloads that exceed Vercel's ~4.5MB proxy limit. */
export function getDirectApiBaseUrl() {
  if (useViteProxyInDev()) return undefined;
  return getApiBaseUrl() || undefined;
}

/** Axios base URL: undefined = relative paths via Vite/Vercel proxy. */
export function getAxiosBaseURL() {
  if (useViteProxyInDev() || shouldUseSameOriginApi()) return undefined;
  return getDirectApiBaseUrl();
}

/** Socket.io origin (Vite proxy supports ws in dev). */
export function getRealtimeOrigin() {
  if (typeof window === 'undefined') return '';
  if (useViteProxyInDev()) return window.location.origin;
  return getDirectApiBaseUrl() || window.location.origin;
}

/** Build API path; home-screen PWAs use same-origin /api for reliable iOS cookies. */
export function apiPath(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (useViteProxyInDev() || shouldUseSameOriginApi()) return normalized;
  const base = getDirectApiBaseUrl();
  return base ? `${base}${normalized}` : normalized;
}
