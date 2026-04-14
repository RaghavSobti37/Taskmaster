import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AdminRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Allow both admin and server_admin roles
  if (user?.role !== 'admin' && user?.role !== 'server_admin') {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default AdminRoute;
