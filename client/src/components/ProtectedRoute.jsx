import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppBootFallback from './AppBootFallback';
import ExternalRedirect from './ExternalRedirect';
import { authUrl, usesExternalAuthHost } from '../config/siteUrls';

const ProtectedRoute = () => {
  const { user, loading, sessionReady } = useAuth();
  const location = useLocation();

  if (loading) return <AppBootFallback />;
  if (user && !sessionReady) return <AppBootFallback />;

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
};

export default ProtectedRoute;
