/** Set before logout redirect so the next page load skips /api/auth/me until cookie is cleared. */
export const FORCE_LOGOUT_KEY = 'coreknot_force_logout';

export function markForceLogout() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(FORCE_LOGOUT_KEY, String(Date.now()));
}

export function consumeForceLogout() {
  if (typeof sessionStorage === 'undefined') return false;
  const flag = sessionStorage.getItem(FORCE_LOGOUT_KEY);
  if (!flag) return false;
  sessionStorage.removeItem(FORCE_LOGOUT_KEY);
  return true;
}
