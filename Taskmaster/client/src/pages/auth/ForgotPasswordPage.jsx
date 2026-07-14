import { Navigate } from 'react-router-dom';
import { isClerkConfigured } from '../../config/clerk';

/**
 * Password reset lives inside Clerk SignIn (factor-one → Forgot password).
 * Hash `#/reset-password` jumps to "set new password" without a reset session — broken.
 * Send users to /login with a hint to start the email-only step.
 */
export default function ForgotPasswordPage() {
  if (!isClerkConfigured()) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to="/login?forgot=1" replace />;
}
