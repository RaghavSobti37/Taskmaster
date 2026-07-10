/**
 * Resolve post-login navigation target from router state, ?redirect=, or stored return path.
 */
import { resolveAppNavigationTarget } from '../config/siteUrls';

/** Never send authenticated users to marketing/auth entry routes after login. */
const POST_LOGIN_PATH_BLOCK = new Set([
  '/',
  '/landing',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/relegends',
  '/privacy',
  '/userdata',
]);

const pathOnly = (target) => String(target || '').split('?')[0].split('#')[0];

export const sanitizePostLoginPath = (target) => {
  const normalized = pathOnly(target);
  if (!normalized || !normalized.startsWith('/') || normalized.startsWith('//')) {
    return '/dashboard';
  }
  if (POST_LOGIN_PATH_BLOCK.has(normalized) || normalized.startsWith('/login')) {
    return '/dashboard';
  }
  return target;
};

export function resolveLoginReturnPath({ stateFrom, search = '', storedReturnPath = null }) {
  if (stateFrom?.pathname) {
    const fromTarget = `${stateFrom.pathname}${stateFrom.search || ''}${stateFrom.hash || ''}`;
    return resolveAppNavigationTarget(sanitizePostLoginPath(fromTarget));
  }

  const redirectParam = new URLSearchParams(search).get('redirect');
  if (redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')) {
    return resolveAppNavigationTarget(sanitizePostLoginPath(redirectParam));
  }

  return resolveAppNavigationTarget(sanitizePostLoginPath(storedReturnPath || '/dashboard'));
}
