import { Navigate, useLocation } from 'react-router-dom';
import { isClerkConfigured } from '../../config/clerk';

/** Legacy reset links redirect to Clerk sign-in reset flow. */
export default function ResetPasswordPage() {
  const location = useLocation();
  if (!isClerkConfigured()) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={`/login/reset-password${location.search || ''}`} replace />;
}
