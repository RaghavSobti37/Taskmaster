import axios from 'axios';
import { SEVERITY, MODULE } from './systemLogContract';
import { getClientTraceId } from './systemLogBridge';

const SKIP_PATHS = new Set(['/', '/login', '/register', '/relegends']);
const DEBOUNCE_MS = 4000;

let lastTracked = '';
let pendingPath = null;
let debounceTimer = null;

function flushPageView() {
  if (!pendingPath) return;
  const { pathname, search } = pendingPath;
  pendingPath = null;

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
          'x-telemetry': 'page-view',
        },
      }
    )
    .catch(() => {});
}

/**
 * Record a page view for ops analytics (silent — no toast).
 * Debounced so rapid navigation does not hammer auth + logging APIs.
 */
export function trackPageView(pathname, search = '') {
  if (!pathname || SKIP_PATHS.has(pathname)) return;
  const key = `${pathname}${search || ''}`;
  if (key === lastTracked && !pendingPath) return;

  pendingPath = { pathname, search };
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    lastTracked = key;
    flushPageView();
  }, DEBOUNCE_MS);
}
