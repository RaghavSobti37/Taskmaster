import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth as useClerkAuth, useClerk } from '@clerk/react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { isClerkConfigured, getPinnedClerkOrganizationId } from '../../config/clerk';
import { isAuthSite } from '../../config/siteMode';
import { resolveLoginReturnPath } from '../../utils/loginReturnPath';
import { registerClerkSignOut } from '../../lib/clerkLogoutRegistry';
import {
  clearClerkEstablishError,
  setClerkEstablishError,
} from '../../lib/clerkEstablishRegistry';
import { fetchClerkEstablishToken } from '../../lib/clerkEstablishToken';
import { isClerkReadyForCoreKnotEstablish } from '../../lib/clerkSignInFlow';
import { AXIOS_SKIP_TOAST } from '../../lib/notifications';

/** Dedupe establish across React StrictMode remounts. */
let establishInflight = null;
let establishForClerkSession = null;

const clearEstablishInflight = () => {
  establishInflight = null;
  establishForClerkSession = null;
};

const resetEstablishState = () => {
  clearEstablishInflight();
  clearClerkEstablishError();
};

const extractEstablishError = (err, fallback) => {
  const status = err?.response?.status;
  const message = err?.response?.data?.error || err?.message || fallback;
  return { status, message };
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
  const { isLoaded, isSignedIn, getToken, signOut, userId, orgId, sessionId } = useClerkAuth();
  const { setActive } = useClerk();
  const location = useLocation();
  const pinnedOrgId = getPinnedClerkOrganizationId();
  const { user, sessionReady, login, applySessionUser } = useAuth();
  const signOutRef = useRef(signOut);
  const redirectedRef = useRef(false);
  const [establishAttempt, setEstablishAttempt] = useState(0);

  useEffect(() => {
    signOutRef.current = signOut;
  }, [signOut]);

  useEffect(() => {
    if (!sessionReady) {
      redirectedRef.current = false;
    }
  }, [sessionReady]);

  useEffect(() => {
    if (!isAuthSite() || !user?._id || !sessionReady || redirectedRef.current) {
      return undefined;
    }
    const target = resolveLoginReturnPath({ search: window.location.search });
    if (!/^https?:\/\//i.test(target)) return undefined;
    try {
      if (new URL(target).origin === window.location.origin) return undefined;
    } catch {
      return undefined;
    }
    redirectedRef.current = true;
    window.location.replace(target);
    return undefined;
  }, [user?._id, sessionReady]);

  useEffect(() => {
    if (!isClerkConfigured()) return undefined;
    registerClerkSignOut(async () => {
      resetEstablishState();
      await signOutRef.current();
    });
    return () => registerClerkSignOut(null);
  }, []);

  useEffect(() => {
    if (!isClerkConfigured() || !isLoaded) {
      return undefined;
    }
    if (!isSignedIn) {
      resetEstablishState();
      return undefined;
    }
    if (!isClerkReadyForCoreKnotEstablish({
      pathname: location.pathname,
      isLoaded,
      isSignedIn,
      sessionId,
    })) {
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
        const tokenResult = await fetchClerkEstablishToken({
          getToken,
          setActive,
          pinnedOrgId,
          activeOrgId: orgId,
        });
        if (cancelled) return;

        if (!tokenResult.ok) {
          if (tokenResult.retryable && establishAttempt < ESTABLISH_MAX_ATTEMPTS) {
            establishForClerkSession = null;
            window.setTimeout(() => {
              if (!cancelled) setEstablishAttempt((n) => n + 1);
            }, ESTABLISH_RETRY_MS);
            return;
          }
          setClerkEstablishError(tokenResult.error);
          if (!tokenResult.retryable) {
            clearEstablishInflight();
            try {
              await signOutRef.current();
            } catch {
              // ignore
            }
          }
          return;
        }

        const { token } = tokenResult;

        let establishResponse;
        try {
          establishResponse = await axios.post(
            '/api/auth/clerk-establish',
            {
              token,
              ...(pinnedOrgId ? { organizationId: pinnedOrgId } : {}),
            },
            { withCredentials: true, ...AXIOS_SKIP_TOAST },
          );
        } catch (err) {
          const status = err?.response?.status;
          const { message } = extractEstablishError(
            err,
            'Could not start your CoreKnot session after Clerk sign-in.',
          );
          if (status === 401 || status === 403) {
            setClerkEstablishError({ status, message });
            clearEstablishInflight();
            try {
              await signOutRef.current();
            } catch {
              // ignore
            }
            return;
          }
          if (establishAttempt < ESTABLISH_MAX_ATTEMPTS) {
            establishForClerkSession = null;
            window.setTimeout(() => {
              if (!cancelled) setEstablishAttempt((n) => n + 1);
            }, ESTABLISH_RETRY_MS);
          } else {
            setClerkEstablishError({ status, message });
          }
          return;
        }

        if (establishResponse?.data?._id) {
          clearClerkEstablishError();
          applySessionUser(establishResponse.data);
        }

        try {
          await login();
        } catch (loginErr) {
          const { message } = extractEstablishError(
            loginErr,
            'Signed in with Clerk but could not load your workspace session.',
          );
          if (establishAttempt < ESTABLISH_MAX_ATTEMPTS) {
            establishForClerkSession = null;
            window.setTimeout(() => {
              if (!cancelled) setEstablishAttempt((n) => n + 1);
            }, ESTABLISH_RETRY_MS);
          } else {
            setClerkEstablishError({ message });
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
    sessionId,
    location.pathname,
    userId,
    orgId,
    pinnedOrgId,
    user,
    sessionReady,
    getToken,
    setActive,
    login,
    applySessionUser,
    establishAttempt,
  ]);

  return null;
}
