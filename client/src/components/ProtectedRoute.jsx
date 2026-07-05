import React, { useEffect, useRef, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isClerkConfigured } from '../config/clerk';
import AppBootError from './AppBootError';
import BootScreen from './BootScreen';
import ClearSessionCookiesButton from './auth/ClearSessionCookiesButton';
import ExternalRedirect from './ExternalRedirect';
import WithClerkWhenConfigured from './auth/WithClerkWhenConfigured';
import { subscribeClerkEstablishError } from '../lib/clerkEstablishRegistry';
import { authUrl, usesExternalAuthHost } from '../config/siteUrls';
import { redirectToLogin } from '../utils/authNavigation';

const CLERK_ESTABLISH_TIMEOUT_MS = 15_000;

function ProtectedRouteInner({ clerkLoaded, clerkSignedIn }) {
  const { user, loading, sessionReady, bootError, retryBoot } = useAuth();
  const location = useLocation();
  const [establishError, setEstablishError] = useState(null);
  const [establishTimedOut, setEstablishTimedOut] = useState(false);
  const pendingSinceRef = useRef(null);

  useEffect(() => subscribeClerkEstablishError(setEstablishError), []);

  const clerkBoot = isClerkConfigured() && !clerkLoaded;
  const sessionEstablished = Boolean(user && sessionReady);
  const clerkSessionPending = isClerkConfigured()
    && clerkLoaded
    && clerkSignedIn
    && !sessionEstablished
    && !bootError
    && !establishError;

  useEffect(() => {
    if (!clerkSessionPending) {
      pendingSinceRef.current = null;
      setEstablishTimedOut(false);
      return undefined;
    }
    if (!pendingSinceRef.current) {
      pendingSinceRef.current = Date.now();
    }
    const timer = window.setTimeout(() => {
      setEstablishTimedOut(true);
    }, CLERK_ESTABLISH_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [clerkSessionPending]);

  if (bootError) {
    return <AppBootError bootError={bootError} onRefresh={() => retryBoot()} />;
  }

  if (establishError) {
    return (
      <>
        <AppBootError
          summary={establishError.message || 'Could not start your workspace session.'}
          error={establishError}
          onRefresh={() => retryBoot()}
        />
        <ClearSessionCookiesButton bootError stuckLogin className="mt-4" />
      </>
    );
  }

  if (establishTimedOut && clerkSessionPending) {
    if (usesExternalAuthHost()) {
      redirectToLogin({
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      });
      return <BootScreen onRefresh={() => retryBoot()} />;
    }
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!sessionEstablished && (clerkBoot || loading || clerkSessionPending)) {
    return <BootScreen bootError={bootError} onRefresh={() => retryBoot()} />;
  }

  if (!user) {
    if (usesExternalAuthHost()) {
      const returnPath = `${location.pathname}${location.search}${location.hash}`;
      const params = new URLSearchParams();
      if (returnPath && returnPath !== '/') {
        params.set('redirect', returnPath);
      }
      const query = params.toString();
      const target = query ? `${authUrl('/login')}?${query}` : authUrl('/login');
      return <ExternalRedirect to={target} />;
    }
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

const ProtectedRoute = () => (
  <WithClerkWhenConfigured>
    {({ isLoaded: clerkLoaded, isSignedIn: clerkSignedIn }) => (
      <ProtectedRouteInner clerkLoaded={clerkLoaded} clerkSignedIn={clerkSignedIn} />
    )}
  </WithClerkWhenConfigured>
);

export default ProtectedRoute;
