import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isClerkConfigured } from '../config/clerk';
import AppBootError from './AppBootError';
import BootScreen from './BootScreen';
import ExternalRedirect from './ExternalRedirect';
import WithClerkWhenConfigured from './auth/WithClerkWhenConfigured';
import { authUrl, usesExternalAuthHost } from '../config/siteUrls';

function ProtectedRouteInner({ clerkLoaded, clerkSignedIn }) {
  const { user, loading, sessionReady, bootError, retryBoot } = useAuth();
  const location = useLocation();

  const clerkBoot = isClerkConfigured() && !clerkLoaded;
  const clerkSessionPending = isClerkConfigured()
    && clerkLoaded
    && clerkSignedIn
    && !user
    && !bootError;

  if (bootError) {
    return <AppBootError message={bootError} onRefresh={() => retryBoot()} />;
  }

  const sessionEstablished = Boolean(user && sessionReady);

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
