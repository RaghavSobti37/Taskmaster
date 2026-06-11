/** API origin for OAuth redirects and absolute URLs. Empty = same-origin / Vite proxy. */
export function getApiBaseUrl() {
  return (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
}

/** Vite dev server always proxies /api and /socket.io to localhost:5000. */
export function isViteProxyDev() {
  return import.meta.env.DEV;
}

/** Direct API origin — unused for axios routing; kept for absolute URL helpers. */
export function getDirectApiBaseUrl() {
  if (import.meta.env.PROD) return undefined;
  if (isViteProxyDev()) return undefined;
  return getApiBaseUrl() || undefined;
}

/** Dev + production: relative /api so cookies stay on the page origin (Vite or Vercel proxy). */
const routeViaSameOriginApi = () => import.meta.env.DEV || import.meta.env.PROD;

/** Axios base URL: undefined = relative paths via Vite/Vercel proxy. */
export function getAxiosBaseURL() {
  if (routeViaSameOriginApi()) return undefined;
  return getDirectApiBaseUrl();
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

/** Build API path — always same-origin /api in production. */
export function apiPath(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (routeViaSameOriginApi()) return normalized;
  const base = getDirectApiBaseUrl();
  return base ? `${base}${normalized}` : normalized;
}
