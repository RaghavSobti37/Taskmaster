import { AuthenticateWithRedirectCallback } from '@clerk/clerk-react';
import AppBootFallback from '../../components/AppBootFallback';
import useClerkSessionExchange from '../../components/auth/useClerkSessionExchange';
import { useNavigate } from 'react-router-dom';
import { navigateAfterAuth } from '../../utils/authNavigation';
import { resolveLoginReturnPath } from '../../utils/loginReturnPath';
import { consumeAuthReturnPath } from '../../lib/authUnauthorized';

export default function ClerkCallbackPage() {
  const navigate = useNavigate();
  const returnPath = resolveLoginReturnPath({
    storedReturnPath: consumeAuthReturnPath(),
  });

  const { error, exchanging } = useClerkSessionExchange({
    onSuccess: () => navigateAfterAuth(navigate, returnPath),
  });

  if (error) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          <p className="font-semibold">Sign-in failed</p>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (exchanging) {
    return <AppBootFallback />;
  }

  return <AuthenticateWithRedirectCallback />;
}
