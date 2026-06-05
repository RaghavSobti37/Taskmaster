import { isMobileBrowser, isStandaloneDisplay, shouldUseSameOriginApi } from './displayMode';

const LOCAL_API_RE = /^https?:\/\/(localhost|127\.0\.0\.1):5000\/?$/i;

const debugApiRouting = (location, message, data, hypothesisId) => {
  // #region agent log
  fetch('http://127.0.0.1:7696/ingest/9fe794f2-6839-468d-9f06-29f35c20a490', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '07dabc' },
    body: JSON.stringify({
      sessionId: '07dabc',
      location,
      message,
      data,
      hypothesisId,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
};

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
  const sameOrigin = shouldUseSameOriginApi();
  const base = useViteProxyInDev() || sameOrigin ? undefined : getDirectApiBaseUrl();
  if (typeof window !== 'undefined') {
    debugApiRouting('apiBase.js:getAxiosBaseURL', 'axios base URL resolved', {
      sameOrigin,
      isMobileBrowser: isMobileBrowser(),
      isStandaloneDisplay: isStandaloneDisplay(),
      axiosBaseURL: base || null,
      pageOrigin: window.location.origin,
      apiEnvUrl: getApiBaseUrl() || null,
      coarsePointer: window.matchMedia('(pointer: coarse)').matches,
      uaMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
    }, 'A');
  }
  return base;
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
  const sameOrigin = useViteProxyInDev() || shouldUseSameOriginApi();
  const resolved = sameOrigin ? normalized : (getDirectApiBaseUrl() ? `${getDirectApiBaseUrl()}${normalized}` : normalized);
  if (typeof window !== 'undefined' && normalized.startsWith('/api/auth')) {
    debugApiRouting('apiBase.js:apiPath', 'auth api path resolved', {
      inputPath: path,
      sameOrigin,
      resolved,
      pageOrigin: window.location.origin,
    }, 'C');
  }
  return resolved;
}
