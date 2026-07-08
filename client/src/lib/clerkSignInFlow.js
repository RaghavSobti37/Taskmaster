/** Clerk path-routed auth sub-routes still in progress (SignIn + SignUp). */
const PENDING_AUTH_SEGMENTS = new Set([
  'client-trust',
  'factor-one',
  'factor-two',
  'sso-callback',
  'reset-password',
  'reset-password-success',
  'verify',
  'choose',
  'choose-wallet',
  'continue',
]);

const AUTH_ROUTE_PREFIXES = ['/login', '/register'];

/**
 * Clerk path routing can update the browser URL before React Router pathname catches up.
 * Prefer the more specific /login/* or /register/* segment when both are available.
 */
export function resolveClerkAuthPathname(routerPathname = '/') {
  const router = String(routerPathname || '');
  if (typeof window === 'undefined') return router;
  const browser = window.location.pathname || '';
  const prefix = AUTH_ROUTE_PREFIXES.find(
    (p) => browser.startsWith(p) || router.startsWith(p),
  );
  if (!prefix) return router;
  if (browser.startsWith(prefix) && router.startsWith(prefix)) {
    return browser.length >= router.length ? browser : router;
  }
  if (browser.startsWith(prefix)) return browser;
  if (router.startsWith(prefix)) return router;
  return router;
}

/** @deprecated use resolveClerkAuthPathname */
export function resolveClerkSignInPathname(routerPathname = '/') {
  return resolveClerkAuthPathname(routerPathname);
}

export function isClerkAuthSubflowPath(pathname) {
  const path = String(pathname || '');
  const match = path.match(/^\/(?:login|register)\/([^/?#]+)/);
  if (!match) return false;
  return PENDING_AUTH_SEGMENTS.has(match[1]);
}

/** @deprecated use isClerkAuthSubflowPath */
export function isClerkSignInSubflowPath(pathname) {
  return isClerkAuthSubflowPath(pathname);
}

/** Safe to tear down Clerk SignIn/SignUp and run clerk-establish. */
export function isClerkReadyForCoreKnotEstablish({
  pathname,
  isLoaded,
  isSignedIn,
  sessionId,
}) {
  if (!isLoaded || !isSignedIn || !sessionId) return false;
  if (isClerkAuthSubflowPath(pathname)) return false;
  return true;
}

/**
 * Exhaustive login/signup UI states for auth host.
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

  const authPath = resolveClerkAuthPathname(pathname);

  if (isClerkAuthSubflowPath(authPath)) {
    return 'SHOW_SIGN_IN';
  }

  if (user && sessionReady) return 'REDIRECTING';

  const readyForEstablish = isClerkReadyForCoreKnotEstablish({
    pathname: authPath,
    isLoaded: clerkLoaded,
    isSignedIn: clerkSignedIn,
    sessionId: clerkSessionId,
  });

  if (readyForEstablish && (!user || !sessionReady)) {
    return 'ESTABLISHING';
  }

  // Session probe (`authLoading`) must not hide SignIn — cold API would flash BootScreen past smoke timeouts.
  return 'SHOW_SIGN_IN';
}
