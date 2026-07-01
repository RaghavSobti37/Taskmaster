import { isClerkEnabled } from '../../lib/clerkConfig';
import ClerkLoginPage from './ClerkLoginPage';
import LegacyLoginPage from './LegacyLoginPage';

export default function LoginPage() {
  return isClerkEnabled() ? <ClerkLoginPage /> : <LegacyLoginPage />;
}
