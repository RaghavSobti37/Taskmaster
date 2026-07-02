/** Clerk `<SignIn routing="path" path="/login" />` sub-routes still in progress. */
const PENDING_SIGN_IN_SEGMENTS = new Set([
  'client-trust',
  'factor-one',
  'factor-two',
  'sso-callback',
  'reset-password',
  'reset-password-success',
  'verify',
  'choose',
  'choose-wallet',
]);

/**
 * Clerk path routing can update the browser URL before React Router pathname catches up.
 * Prefer the more specific /login/* segment when both are available.
 */
export function resolveClerkSignInPathname(routerPathname = '/') {
  const router = String(routerPathname || '');
  if (typeof window === 'undefined') return router;
  const browser = window.location.pathname || '';
  if (!browser.startsWith('/login')) return router;
  if (!router.startsWith('/login')) return browser;
  return browser.length >= router.length ? browser : router;
}

export function isClerkSignInSubflowPath(pathname) {
  const match = String(pathname || '').match(/^\/login\/([^/?#]+)/);
  if (!match) return false;
  return PENDING_SIGN_IN_SEGMENTS.has(match[1]);
}

/** Safe to tear down `<SignIn />` and run clerk-establish. */
export function isClerkReadyForCoreKnotEstablish({
  pathname,
  isLoaded,
  isSignedIn,
  sessionId,
}) {
  if (!isLoaded || !isSignedIn || !sessionId) return false;
  if (isClerkSignInSubflowPath(pathname)) return false;
  return true;
}

/**
 * Exhaustive login UI states for auth host.
 * @returns {'BOOT_ERROR'|'BOOT_LOADING'|'ESTABLISH_ERROR'|'ESTABLISHING'|'REDIRECTING'|'SHOW_SIGN_IN'}
 */
export function computeLoginUiState({
  clerkReady,
  clerkLoaded,
  clerkSignedIn,
  clerkSessionId,
  pathname,
  authLoading,
  user,
  sessionReady,
  establishError,
  bootError,
}) {
  if (bootError) return 'BOOT_ERROR';
  if (!clerkReady) return 'SHOW_SIGN_IN';
  if (!clerkLoaded) return 'BOOT_LOADING';
  if (establishError) return 'ESTABLISH_ERROR';

  const signInPath = resolveClerkSignInPathname(pathname);

  // Never tear down Clerk SignIn or show establish/redirect chrome during OTP/MFA subflows.
  if (isClerkSignInSubflowPath(signInPath)) {
    return 'SHOW_SIGN_IN';
  }

  if (user && sessionReady) return 'REDIRECTING';

  const readyForEstablish = isClerkReadyForCoreKnotEstablish({
    pathname: signInPath,
    isLoaded: clerkLoaded,
    isSignedIn: clerkSignedIn,
    sessionId: clerkSessionId,
  });

  if (readyForEstablish && (!user || !sessionReady)) {
    return 'ESTABLISHING';
  }

  // Session probe — don't tear down SignIn while user is typing credentials
  if (authLoading && !clerkSignedIn) return 'BOOT_LOADING';

  return 'SHOW_SIGN_IN';
}
