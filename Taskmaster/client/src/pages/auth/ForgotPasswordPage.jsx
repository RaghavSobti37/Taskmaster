import { Navigate } from 'react-router-dom';
import { isClerkConfigured } from '../../config/clerk';

/** Password reset is handled inside Clerk SignIn. */
export default function ForgotPasswordPage() {
  if (!isClerkConfigured()) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to="/login/reset-password" replace />;
}
