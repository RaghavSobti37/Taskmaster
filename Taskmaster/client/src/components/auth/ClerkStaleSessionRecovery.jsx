import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth as useClerkAuth, useClerk } from '@clerk/react';
import { isClerkConfigured } from '../../config/clerk';
import { isAuthSite } from '../../config/siteMode';
import { useAuth } from '../../contexts/AuthContext';
import { isClerkAuthSubflowPath, resolveClerkAuthPathname } from '../../lib/clerkSignInFlow';
import { shouldSignOutStaleClerkSession } from '../../lib/clerkStaleSession';

/**
 * Clears invalid Clerk sessions on auth host before sign-in.
 * Stale __session cookies cause session/touch 401 during Clerk setActive after password submit.
 * Null getToken() right after password submit is normal — do not signOut (races clerk-establish).
 */
export default function ClerkStaleSessionRecovery() {
  if (!isClerkConfigured() || !isAuthSite()) return null;
  return <ClerkStaleSessionRecoveryInner />;
}

function ClerkStaleSessionRecoveryInner() {
  const { isLoaded, isSignedIn, sessionId } = useClerkAuth();
  const { getToken, signOut } = useClerk();
  const { user, sessionReady } = useAuth();
  const location = useLocation();
  const checkedRef = useRef('');

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !sessionId) return undefined;

    const authPath = resolveClerkAuthPathname(location.pathname);
    if (isClerkAuthSubflowPath(authPath)) return undefined;
    if (user && sessionReady) return undefined;

    const key = `${sessionId}:${authPath}`;
    if (checkedRef.current === key) return undefined;
    checkedRef.current = key;

    let cancelled = false;

    (async () => {
      try {
        const token = await getToken();
        if (cancelled) return;
        if (!shouldSignOutStaleClerkSession({ token })) return;
        await signOut();
        checkedRef.current = '';
      } catch (err) {
        if (cancelled) return;
        if (!shouldSignOutStaleClerkSession({ token: null, error: err })) return;
        try {
          await signOut();
        } catch {
          // ignore
        }
        checkedRef.current = '';
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isLoaded,
    isSignedIn,
    sessionId,
    location.pathname,
    user,
    sessionReady,
    getToken,
    signOut,
  ]);

  return null;
}
