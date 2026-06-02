/** API origin for auth redirects (OAuth) and absolute URLs. Empty = same-origin / Vite proxy. */
export function getApiBaseUrl() {
  return (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
}

/** Build API path; uses VITE_API_URL when set (production cross-origin). */
export function apiPath(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBaseUrl();
  return base ? `${base}${normalized}` : normalized;
}
