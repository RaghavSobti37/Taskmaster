import { getDirectApiBaseUrl } from './apiBase';

/** null = unchecked, true/false = last probe result */
let proxyHealthy = null;
let probePromise = null;

const PROBE_TIMEOUT_MS = 8000;

/** True when same-origin /api rewrite reaches a healthy API. */
export function isApiProxyHealthy() {
  return proxyHealthy;
}

export function markApiProxyUnhealthy() {
  proxyHealthy = false;
}

export function resetApiProxyHealth() {
  proxyHealthy = null;
  probePromise = null;
}

/** Probe GET /api/health on the frontend origin (Vercel rewrite path). */
export async function probeApiProxyHealth() {
  if (typeof window === 'undefined') return true;
  if (proxyHealthy !== null) return proxyHealthy;
  if (probePromise) return probePromise;

  probePromise = (async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      const res = await fetch('/api/health', {
        credentials: 'include',
        signal: controller.signal,
        headers: { 'x-skip-toast': '1' },
      });
      proxyHealthy = res.ok;
    } catch {
      proxyHealthy = false;
    } finally {
      window.clearTimeout(timer);
    }
    return proxyHealthy;
  })();

  return probePromise;
}

/** Use direct Render API when embedded VITE_API_URL exists and /api proxy is down. */
export function shouldFallbackToDirectApi() {
  return proxyHealthy === false && Boolean(getDirectApiBaseUrl());
}
