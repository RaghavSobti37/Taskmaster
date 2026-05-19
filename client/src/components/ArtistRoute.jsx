import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ArtistRoute = () => {
  const { user, loading } = useAuth();

  if (loading) return null;

  const hasAccess = user?.role === 'admin' || user?.role === 'artist_management';
  return hasAccess ? <Outlet /> : <Navigate to="/" replace />;
};

export default ArtistRoute;
