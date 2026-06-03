import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { DashboardSkeleton } from './ui';

const ProtectedRoute = () => {
  const { user, loading, sessionReady } = useAuth();

  // #region agent log
  fetch('http://127.0.0.1:7696/ingest/9fe794f2-6839-468d-9f06-29f35c20a490',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1b191b'},body:JSON.stringify({sessionId:'1b191b',hypothesisId:'A',location:'ProtectedRoute.jsx',message:'protected route gate',data:{loading,sessionReady,hasUser:!!user,path:typeof window!=='undefined'?window.location.pathname:''},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  if (loading) return <DashboardSkeleton />;
  if (user && !sessionReady) return <DashboardSkeleton />;

  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
