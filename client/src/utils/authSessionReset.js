import axios from 'axios';
import { runClerkSignOut } from '../lib/clerkLogoutRegistry';
import { markForceLogout } from './authSession';
import { AXIOS_SKIP_TOAST } from '../lib/notifications';

/** Hide clear-session CTA after one successful reset (per browser). */
export const SESSION_RESET_DONE_KEY = 'coreknot_auth_session_reset_done_v1';

const AUTH_COOKIE_NAMES = ['coreknot_token_v3', 'coreknot_token_v2', 'coreknot_token'];

const COOKIE_DOMAINS = (() => {
  if (typeof window === 'undefined') return [''];
  const host = window.location.hostname.toLowerCase();
  const domains = new Set(['']);
  if (host === 'tsccoreknot.com' || host.endsWith('.tsccoreknot.com')) {
    domains.add('.tsccoreknot.com');
    domains.add('tsccoreknot.com');
  }
  if (host) domains.add(host);
  return [...domains];
})();

export function hasCompletedSessionReset() {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(SESSION_RESET_DONE_KEY) === '1';
}

export function markSessionResetDone() {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SESSION_RESET_DONE_KEY, '1');
}

/** Show until user clears once; always offer when boot is failing or login is stuck. */
export function shouldOfferSessionReset({ bootError = false, stuckLogin = false } = {}) {
  if (bootError || stuckLogin) return true;
  return !hasCompletedSessionReset();
}

/** Best-effort expire for non-HttpOnly duplicates / legacy client cookies. */
export function expireReadableAuthCookies() {
  if (typeof document === 'undefined') return;
  for (const name of AUTH_COOKIE_NAMES) {
    for (const domain of COOKIE_DOMAINS) {
      const base = `${name}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      document.cookie = domain ? `${base}; domain=${domain}` : base;
    }
  }
}

/**
 * Wipe CoreKnot + Clerk session state so a fresh login can set new cookies.
 * Server logout clears HttpOnly variants (v1/v2/v3, partitioned, shared domain).
 */
export async function resetAuthSession() {
  markForceLogout();
  await runClerkSignOut();
  try {
    await axios.post('/api/auth/logout', {}, { withCredentials: true, ...AXIOS_SKIP_TOAST });
  } catch {
    // Still expire readable cookies and reload
  }
  expireReadableAuthCookies();
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('coreknot_force_logout');
  }
  markSessionResetDone();
}
