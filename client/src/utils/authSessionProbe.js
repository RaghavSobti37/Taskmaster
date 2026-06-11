import { apiPath } from './apiBase';
import { getClientTraceId } from '../lib/systemLogBridge';

/** Headers for initial session probe — skip toasts and error telemetry. */
export const AUTH_SESSION_PROBE_HEADERS = {
  'x-skip-toast': 'true',
  'x-silent-auth-probe': 'true',
};

/**
 * Silent GET /api/auth/me for session bootstrap.
 * Uses fetch (not axios) so expected 401 when logged out does not surface as a rejected XHR in DevTools.
 */
export async function probeAuthSession() {
  const res = await fetch(apiPath('/api/auth/me'), {
    method: 'GET',
    credentials: 'include',
    headers: {
      ...AUTH_SESSION_PROBE_HEADERS,
      'X-Trace-Id': getClientTraceId(),
    },
  });

  if (res.status === 401 || res.status === 403) {
    return { status: res.status, user: null };
  }

  if (!res.ok) {
    const err = new Error(`auth session probe failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }

  const user = await res.json();
  return { status: res.status, user };
}
