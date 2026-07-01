import { useEffect, useRef } from 'react';
import { useAuth as useClerkAuth } from '@clerk/react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { isClerkConfigured } from '../../config/clerk';
import { registerClerkSignOut } from '../../lib/clerkLogoutRegistry';
import { AXIOS_SKIP_TOAST } from '../../lib/notifications';
import { resolveLoginReturnPath } from '../../utils/loginReturnPath';
import { navigateAfterAuth } from '../../utils/authNavigation';
import { consumeAuthReturnPath } from '../../lib/authUnauthorized';

/**
 * After Clerk sign-in, exchange Clerk JWT for CoreKnot HttpOnly session cookie.
 */
export default function ClerkSessionBridge() {
  const { isLoaded, isSignedIn, getToken, signOut } = useClerkAuth();
  const { user, sessionReady, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!isClerkConfigured()) return undefined;
    registerClerkSignOut(() => signOut());
    return () => registerClerkSignOut(null);
  }, [signOut]);

  useEffect(() => {
    if (!isClerkConfigured() || !isLoaded || !isSignedIn) return;
    if (user && sessionReady) return;
    if (syncingRef.current) return;

    let cancelled = false;
    syncingRef.current = true;

    (async () => {
      try {
        const token = await getToken();
        if (!token || cancelled) return;

        await axios.post(
          '/api/auth/clerk-establish',
          { token },
          { withCredentials: true, ...AXIOS_SKIP_TOAST },
        );

        if (cancelled) return;
        await login();

        const returnPath = resolveLoginReturnPath({
          stateFrom: location.state?.from,
          search: location.search,
          storedReturnPath: consumeAuthReturnPath(),
        });
        if (returnPath && returnPath !== location.pathname) {
          navigateAfterAuth(navigate, returnPath);
        }
      } catch {
        // Clerk UI still shows error states; CoreKnot login form remains available
      } finally {
        syncingRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
      syncingRef.current = false;
    };
  }, [
    isLoaded,
    isSignedIn,
    user,
    sessionReady,
    getToken,
    login,
    navigate,
    location.pathname,
    location.search,
    location.state,
  ]);

  return null;
}
