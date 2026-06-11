import { markForceLogout } from '../utils/authSession';

export const AUTH_RETURN_KEY = 'coreknot_auth_return_to';

let unauthorizedHandler = null;
let handlingUnauthorized = false;

export function registerUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

export function saveAuthReturnPath() {
  if (typeof window === 'undefined') return;
  const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (path && !path.startsWith('/login')) {
    sessionStorage.setItem(AUTH_RETURN_KEY, path);
  }
}

export function consumeAuthReturnPath() {
  if (typeof sessionStorage === 'undefined') return null;
  const stored = sessionStorage.getItem(AUTH_RETURN_KEY);
  if (stored) sessionStorage.removeItem(AUTH_RETURN_KEY);
  return stored;
}

export function triggerUnauthorized(error) {
  if (handlingUnauthorized) return;
  const url = (error?.config?.url || '').split('?')[0];
  if (url.includes('/api/auth/')) return;
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/login')) return;

  handlingUnauthorized = true;
  saveAuthReturnPath();
  markForceLogout();

  const run = async () => {
    try {
      if (unauthorizedHandler) {
        await unauthorizedHandler(error);
        return;
      }
    } catch {
      /* fall through */
    }
    window.location.assign('/login');
  };

  run().finally(() => {
    handlingUnauthorized = false;
  });
}
