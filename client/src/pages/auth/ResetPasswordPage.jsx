import { Navigate } from 'react-router-dom';
import { isClerkConfigured } from '../../config/clerk';

/** Legacy reset links redirect to Clerk sign-in reset flow. */
export default function ResetPasswordPage() {
  if (!isClerkConfigured()) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to="/login#/reset-password" replace />;
}
