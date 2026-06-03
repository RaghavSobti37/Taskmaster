import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppBootFallback from './AppBootFallback';

const ProtectedRoute = () => {
  const { user, loading, sessionReady } = useAuth();

  if (loading) return <AppBootFallback />;
  if (user && !sessionReady) return <AppBootFallback />;

  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
