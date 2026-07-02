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
