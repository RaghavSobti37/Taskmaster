import { authUrl, resolveAppNavigationTarget } from '../config/siteUrls';

/** Post-login / post-register — full URL when leaving auth subdomain. */
export function navigateAfterAuth(navigate, target) {
  const resolved = resolveAppNavigationTarget(target);
  if (/^https?:\/\//i.test(resolved)) {
    window.location.replace(resolved);
    return;
  }
  if (typeof navigate === 'function') {
    navigate(resolved, { replace: true });
    return;
  }
  window.location.assign(resolved);
}

/** Unauthenticated redirect — preserves return path for auth subdomain. */
export function redirectToLogin({ pathname = '/', search = '', hash = '' } = {}) {
  const returnPath = `${pathname}${search}${hash}`;
  const base = authUrl('/login');
  if (!returnPath || returnPath === '/' || returnPath.startsWith('/login')) {
    window.location.assign(base);
    return;
  }
  const params = new URLSearchParams();
  params.set('redirect', returnPath);
  window.location.assign(`${base}?${params.toString()}`);
}
