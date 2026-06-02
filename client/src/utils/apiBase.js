const LOCAL_API_RE = /^https?:\/\/(localhost|127\.0\.0\.1):5000\/?$/i;

/** API origin for auth redirects (OAuth) and absolute URLs. Empty = same-origin / Vite proxy. */
export function getApiBaseUrl() {
  return (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
}

/** In dev, localhost:5000 in .env still uses Vite proxy (/api, /socket.io) to avoid CORS and port races. */
export function useViteProxyInDev() {
  return import.meta.env.DEV && LOCAL_API_RE.test(getApiBaseUrl());
}

/** Axios base URL: undefined = relative paths via Vite proxy. */
export function getAxiosBaseURL() {
  if (useViteProxyInDev()) return undefined;
  const base = getApiBaseUrl();
  return base || undefined;
}

/** Socket.io origin (Vite proxy supports ws in dev). */
export function getRealtimeOrigin() {
  if (useViteProxyInDev()) return window.location.origin;
  return getApiBaseUrl() || window.location.origin;
}

/** Build API path; uses VITE_API_URL when set (production cross-origin). */
export function apiPath(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBaseUrl();
  return base ? `${base}${normalized}` : normalized;
}
