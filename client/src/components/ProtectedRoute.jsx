import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = () => {
  const { token, loading } = useAuth();

  if (loading) return null;

  return token ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
