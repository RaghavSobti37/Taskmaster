import axios from 'axios';
import { SEVERITY, MODULE } from './systemLogContract';
import { getClientTraceId } from './systemLogBridge';

const SKIP_PATHS = new Set(['/', '/login', '/register', '/relegends']);
let lastTracked = '';

/**
 * Record a page view for ops analytics (silent — no toast).
 */
export function trackPageView(pathname, search = '') {
  if (!pathname || SKIP_PATHS.has(pathname)) return;
  const key = `${pathname}${search || ''}`;
  if (key === lastTracked) return;
  lastTracked = key;

  axios
    .post(
      '/api/system-logs',
      {
        severity: SEVERITY.INFO,
        module: MODULE.SYSTEM,
        message: pathname,
        userVisible: false,
        errorCode: 'PAGE_VIEW',
        route: pathname,
        payload: search ? { search } : undefined,
      },
      {
        headers: {
          'X-Trace-Id': getClientTraceId(),
          'x-skip-toast': 'true',
        },
      }
    )
    .catch(() => {});
}
