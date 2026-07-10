import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { orgPathFromUser, isOrgSlugRoutesEnabled } from '../../lib/orgPaths';
import BootScreen from '../BootScreen';

/** Redirect legacy flat paths (/dashboard) to /:orgSlug/dashboard. */
export default function LegacyOrgPathRedirect() {
  const { user, sessionReady } = useAuth();
  const location = useLocation();

  if (!isOrgSlugRoutesEnabled()) {
    return null;
  }

  if (!sessionReady) {
    return <BootScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const target = orgPathFromUser(user, `${location.pathname}${location.search}${location.hash}`);
  if (target === location.pathname) {
    return <Navigate to="/org/pick" replace />;
  }

  return <Navigate to={target} replace />;
}
