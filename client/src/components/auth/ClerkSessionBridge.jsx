import { useEffect, useRef } from 'react';
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

/**
 * After Clerk sign-in, exchange Clerk JWT for CoreKnot HttpOnly session cookie.
 * Navigation to app routes is handled by LoginPage once `user` and `sessionReady`.
 */
export default function ClerkSessionBridge() {
  const { isLoaded, isSignedIn, getToken, signOut, userId } = useClerkAuth();
  const { user, sessionReady, login } = useAuth();
  const signOutRef = useRef(signOut);

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
    establishInflight = (async () => {
      try {
        const token = await getToken();
        if (!token) return;

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
          }
          return;
        }

        try {
          await login();
        } catch {
          // login() retries via effect when session cookie is readable
          return;
        }
      } finally {
        if (establishForClerkSession === clerkKey) {
          establishInflight = null;
        }
      }
    })();

    return undefined;
  }, [isLoaded, isSignedIn, userId, user, sessionReady, getToken, login]);

  return null;
}
