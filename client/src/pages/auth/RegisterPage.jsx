import { isClerkEnabled } from '../../lib/clerkConfig';
import ClerkRegisterPage from './ClerkRegisterPage';
import LegacyRegisterPage from './LegacyRegisterPage';

export default function RegisterPage() {
  return isClerkEnabled() ? <ClerkRegisterPage /> : <LegacyRegisterPage />;
}
