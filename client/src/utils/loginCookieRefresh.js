/** One-time login-page control to purge stale HttpOnly session cookies (Jun 2026). */
export const LOGIN_COOKIE_REFRESH_DONE_KEY = 'tm-login-cookie-refresh-done';

export const hasUsedLoginCookieRefresh = () => {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(LOGIN_COOKIE_REFRESH_DONE_KEY) === '1';
};

export const markLoginCookieRefreshUsed = () => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LOGIN_COOKIE_REFRESH_DONE_KEY, '1');
};
