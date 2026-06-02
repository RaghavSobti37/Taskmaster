import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { DashboardSkeleton } from './ui';

const ProtectedRoute = () => {
  const { user, loading } = useAuth();

  if (loading) return <DashboardSkeleton />;

  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
