import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppBootFallback from './AppBootFallback';

const ProtectedRoute = () => {
  const { user, loading, sessionReady } = useAuth();
  const location = useLocation();

  if (loading) return <AppBootFallback />;
  if (user && !sessionReady) return <AppBootFallback />;

  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location }} />;
};

export default ProtectedRoute;
