import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const OpsRoute = () => {
  const { user, loading } = useAuth();

  if (loading) return null;

  const hasAccess = user?.role === 'admin' || user?.role === 'ops';
  return hasAccess ? <Outlet /> : <Navigate to="/dashboard" replace />;
};

export default OpsRoute;
