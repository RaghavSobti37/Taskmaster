import { Navigate } from 'react-router-dom';
import { isClerkConfigured } from '../../config/clerk';

/** Clerk owns password reset after email code — hang off SignIn path routing. */
export default function ResetPasswordPage() {
  if (!isClerkConfigured()) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to="/login?forgot=1" replace />;
}
