import { useEffect, useRef, useState } from 'react';
import { useAuth as useClerkAuth } from '@clerk/react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { isClerkConfigured } from '../../config/clerk';
import { registerClerkSignOut } from '../../lib/clerkLogoutRegistry';
import { AXIOS_SKIP_TOAST } from '../../lib/notifications';

/** Dedupe establish across React StrictMode remounts. */
let establishInflight = null;
let establishForClerkSession = null;

const resetEstablishState = () => {
  establishInflight = null;
  establishForClerkSession = null;
};

const ESTABLISH_RETRY_MS = 1500;
const ESTABLISH_MAX_ATTEMPTS = 5;

/**
 * After Clerk sign-in, exchange Clerk JWT for CoreKnot HttpOnly session cookie.
 * Navigation to app routes is handled by LoginPage once `user` and `sessionReady`.
 */
export default function ClerkSessionBridge() {
  if (!isClerkConfigured()) return null;
  return <ClerkSessionBridgeInner />;
}

function ClerkSessionBridgeInner() {
  const { isLoaded, isSignedIn, getToken, signOut, userId } = useClerkAuth();
  const { user, sessionReady, login } = useAuth();
  const signOutRef = useRef(signOut);
  const [establishAttempt, setEstablishAttempt] = useState(0);

  useEffect(() => {
    signOutRef.current = signOut;
  }, [signOut]);

  useEffect(() => {
    if (!isClerkConfigured()) return undefined;
    registerClerkSignOut(async () => {
      resetEstablishState();
      await signOutRef.current();
    });
    return () => registerClerkSignOut(null);
  }, []);

  useEffect(() => {
    if (!isClerkConfigured() || !isLoaded || !isSignedIn) {
      if (!isSignedIn) resetEstablishState();
      return undefined;
    }
    if (user && sessionReady) {
      resetEstablishState();
      return undefined;
    }

    const clerkKey = userId || 'active';
    if (establishForClerkSession === clerkKey && establishInflight) {
      return undefined;
    }

    establishForClerkSession = clerkKey;
    let cancelled = false;

    establishInflight = (async () => {
      try {
        const token = await getToken();
        if (!token || cancelled) return;

        try {
          await axios.post(
            '/api/auth/clerk-establish',
            { token },
            { withCredentials: true, ...AXIOS_SKIP_TOAST },
          );
        } catch (err) {
          const status = err?.response?.status;
          if (status === 401 || status === 403) {
            resetEstablishState();
            try {
              await signOutRef.current();
            } catch {
              // ignore
            }
            return;
          }
          if (establishAttempt < ESTABLISH_MAX_ATTEMPTS) {
            window.setTimeout(() => {
              if (!cancelled) setEstablishAttempt((n) => n + 1);
            }, ESTABLISH_RETRY_MS);
          }
          return;
        }

        try {
          await login();
        } catch {
          if (establishAttempt < ESTABLISH_MAX_ATTEMPTS) {
            window.setTimeout(() => {
              if (!cancelled) setEstablishAttempt((n) => n + 1);
            }, ESTABLISH_RETRY_MS);
          }
          return;
        }
      } finally {
        if (establishForClerkSession === clerkKey) {
          establishInflight = null;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isLoaded,
    isSignedIn,
    userId,
    user,
    sessionReady,
    getToken,
    login,
    establishAttempt,
  ]);

  return null;
}
