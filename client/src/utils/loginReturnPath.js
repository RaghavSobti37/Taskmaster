/**
 * Resolve post-login navigation target from router state, ?redirect=, or stored return path.
 */
import { resolveAppNavigationTarget } from '../config/siteUrls';

export function resolveLoginReturnPath({ stateFrom, search = '', storedReturnPath = null }) {
  if (stateFrom?.pathname) {
    return resolveAppNavigationTarget(
      `${stateFrom.pathname}${stateFrom.search || ''}${stateFrom.hash || ''}`,
    );
  }

  const redirectParam = new URLSearchParams(search).get('redirect');
  if (redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')) {
    return resolveAppNavigationTarget(redirectParam);
  }

  return resolveAppNavigationTarget(storedReturnPath || '/dashboard');
}
