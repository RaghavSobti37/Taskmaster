import { apiPath } from './apiBase';
import { getClientTraceId } from '../lib/systemLogBridge';
import { fetchWithTimeout } from './fetchWithTimeout';

/** Headers for initial session probe — skip toasts and error telemetry. */
export const AUTH_SESSION_PROBE_HEADERS = {
  'x-skip-toast': 'true',
  'x-silent-auth-probe': 'true',
};

const SESSION_PROBE_TIMEOUT_MS = 12000;

/**
 * Silent GET /api/auth/session for session bootstrap.
 * Returns 200 { authenticated: false } when logged out — avoids 401 noise in DevTools.
 */
export async function probeAuthSession() {
  const res = await fetchWithTimeout(
    apiPath('/api/auth/session'),
    {
      method: 'GET',
      credentials: 'include',
      headers: {
        ...AUTH_SESSION_PROBE_HEADERS,
        'X-Trace-Id': getClientTraceId(),
      },
    },
    SESSION_PROBE_TIMEOUT_MS,
  );

  // ponytail: broken Vercel /api proxy returns 404 — treat as logged out, not fatal
  if (res.status === 404) {
    return { status: 401, user: null };
  }

  if (!res.ok && res.status !== 403) {
    const err = new Error(`auth session probe failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }

  let body;
  try {
    body = await res.json();
  } catch {
    return { status: 401, user: null };
  }

  if (res.status === 403 || !body?.authenticated) {
    return { status: res.status === 403 ? 403 : 401, user: null };
  }

  return { status: 200, user: body.user };
}
