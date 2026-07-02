import React, { useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth as useClerkAuth } from '@clerk/react';
import { useAuth } from '../../contexts/AuthContext';
import AppBootError from '../../components/AppBootError';
import BootScreen from '../../components/BootScreen';
import AuthMarketingShell from '../../components/auth/AuthMarketingShell';
import ClerkSignUpBlock from '../../components/auth/ClerkSignUpBlock';
import { isClerkConfigured } from '../../config/clerk';
import { registerCopy } from '../../constants/marketingContent';
import { navigateAfterAuth } from '../../utils/authNavigation';
import { resolveLoginReturnPath } from '../../utils/loginReturnPath';

const linkClass =
  'text-[var(--brand-green)] font-medium hover:text-[var(--brand-teal-deep)] underline-offset-2 hover:underline transition-colors';

export default function RegisterPage() {
  if (!isClerkConfigured()) {
    return <RegisterPageView clerkLoaded clerkSignedIn={false} />;
  }
  return <RegisterPageWithClerk />;
}

function RegisterPageWithClerk() {
  const { isLoaded: clerkLoaded, isSignedIn: clerkSignedIn } = useClerkAuth();
  return <RegisterPageView clerkLoaded={clerkLoaded} clerkSignedIn={clerkSignedIn} />;
}

function RegisterPageView({ clerkLoaded, clerkSignedIn }) {
  const { user, loading: authLoading, sessionReady, bootError, retryBoot } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navigatedRef = useRef(false);
  const clerkReady = isClerkConfigured();
  const clerkEstablishing = clerkReady && clerkLoaded && clerkSignedIn && (!user || !sessionReady);

  useEffect(() => {
    if (!user || !sessionReady) {
      navigatedRef.current = false;
      return;
    }
    if (authLoading || navigatedRef.current) return;
    navigatedRef.current = true;
    const target = resolveLoginReturnPath({
      stateFrom: location.state?.from,
      search: location.search,
    });
    navigateAfterAuth(navigate, target);
  }, [authLoading, user, sessionReady, navigate, location.state, location.search]);

  if (bootError) {
    return <AppBootError message={bootError} onRefresh={() => retryBoot()} />;
  }

  if (authLoading || clerkEstablishing) {
    return <BootScreen onRefresh={() => retryBoot()} />;
  }

  const asideLinks = (
    <>
      <span className="text-[var(--brand-teal-mid)]">{registerCopy.signInPrompt}</span>
      <Link to="/login" className={linkClass}>
        {registerCopy.signInLink}
      </Link>
    </>
  );

  return (
    <AuthMarketingShell
      title="Join CoreKnot"
      subtitle={registerCopy.subtitle}
      asideLinks={asideLinks}
    >
      {!clerkReady ? (
        <p className="text-sm text-red-200 text-center">
          Clerk is not configured. Set <code className="text-xs">VITE_CLERK_PUBLISHABLE_KEY</code> in client env.
        </p>
      ) : (
        <ClerkSignUpBlock />
      )}
    </AuthMarketingShell>
  );
}
