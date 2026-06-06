const LOCAL_API_RE = /^https?:\/\/(localhost|127\.0\.0\.1):5000\/?$/i;

/** API origin for OAuth redirects and absolute URLs. Empty = same-origin / Vite proxy. */
export function getApiBaseUrl() {
  return (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
}

/** In dev, localhost:5000 in .env still uses Vite proxy (/api, /socket.io) to avoid CORS and port races. */
export function isViteProxyDev() {
  return import.meta.env.DEV && LOCAL_API_RE.test(getApiBaseUrl());
}

/** Direct API origin — local dev only when not using the Vite proxy. */
export function getDirectApiBaseUrl() {
  if (isViteProxyDev()) return undefined;
  if (import.meta.env.PROD) return undefined;
  return getApiBaseUrl() || undefined;
}

/** Production + Vite dev use same-origin /api so auth cookies stay on the frontend domain. */
const routeViaSameOriginApi = () => isViteProxyDev() || import.meta.env.PROD;

/** Axios base URL: undefined = relative paths via Vite/Vercel proxy. */
export function getAxiosBaseURL() {
  if (routeViaSameOriginApi()) return undefined;
  return getDirectApiBaseUrl();
}

/** Socket.io origin — same host as REST in production so cookies match. */
export function getRealtimeOrigin() {
  if (typeof window === 'undefined') return '';
  if (routeViaSameOriginApi()) return window.location.origin;
  return getDirectApiBaseUrl() || window.location.origin;
}

/** Build API path — always same-origin /api in production. */
export function apiPath(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (routeViaSameOriginApi()) return normalized;
  const base = getDirectApiBaseUrl();
  return base ? `${base}${normalized}` : normalized;
}
