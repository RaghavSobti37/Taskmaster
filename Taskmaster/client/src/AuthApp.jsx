import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import GoogleSuccessPage from './pages/auth/GoogleSuccessPage';
import PrivacyPolicy from './pages/legal/PrivacyPolicy';
import UserDataDeletion from './pages/legal/UserDataDeletion';

/** Auth-host-only routes — static imports; no dashboard lazy chunks in this build. */
export default function AuthApp() {
  useEffect(() => {
    let teardown;
    import('./lib/setupAxiosInterceptors').then(({ setupAxiosInterceptors }) => {
      teardown = setupAxiosInterceptors();
    });
    return () => teardown?.();
  }, []);

  return (
    <RouteErrorBoundary>
      <Routes>
        <Route path="/login/*" element={<LoginPage />} />
        <Route path="/register/*" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/relegends" element={<Navigate to="/login" replace />} />
        <Route path="/auth/google/success" element={<GoogleSuccessPage />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/userdata" element={<UserDataDeletion />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </RouteErrorBoundary>
  );
}
