import { Navigate } from 'react-router-dom';
import { isClerkConfigured } from '../../config/clerk';

/** Start the Clerk-powered password reset flow on the auth host. */
export default function ResetPasswordPage() {
  if (!isClerkConfigured()) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to="/forgot-password" replace />;
}
