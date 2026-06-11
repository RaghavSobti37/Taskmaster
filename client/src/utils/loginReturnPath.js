/**
 * Resolve post-login navigation target from router state, ?redirect=, or stored return path.
 */
export function resolveLoginReturnPath({ stateFrom, search = '', storedReturnPath = null }) {
  if (stateFrom?.pathname) {
    return `${stateFrom.pathname}${stateFrom.search || ''}${stateFrom.hash || ''}`;
  }

  const redirectParam = new URLSearchParams(search).get('redirect');
  if (redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')) {
    return redirectParam;
  }

  return storedReturnPath || '/dashboard';
}
