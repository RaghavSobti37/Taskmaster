import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth as useClerkAuth } from '@clerk/react';
import { useAuth } from '../../contexts/AuthContext';
import AppBootError from '../../components/AppBootError';
import BootScreen from '../../components/BootScreen';
import AuthMarketingShell from '../../components/auth/AuthMarketingShell';
import ClerkSignUpBlock from '../../components/auth/ClerkSignUpBlock';
import ClearSessionCookiesButton from '../../components/auth/ClearSessionCookiesButton';
import { isClerkConfigured } from '../../config/clerk';
import { registerCopy } from '../../constants/marketingContent';
import { resolveLoginReturnPath } from '../../utils/loginReturnPath';
import { subscribeClerkEstablishError } from '../../lib/clerkEstablishRegistry';
import { computeLoginUiState } from '../../lib/clerkSignInFlow';
import { navigateOnce, resetNavigateGuard } from '../../lib/postLoginRedirect';

const linkClass =
  'text-[var(--brand-green)] font-medium hover:text-[var(--brand-teal-deep)] underline-offset-2 hover:underline transition-colors';

export default function RegisterPage() {
  if (!isClerkConfigured()) {
    return <RegisterPageView clerkLoaded clerkSignedIn={false} clerkSessionId={null} pathname="/register" />;
  }
  return <RegisterPageWithClerk />;
}

function RegisterPageWithClerk() {
  const { isLoaded: clerkLoaded, isSignedIn: clerkSignedIn, sessionId: clerkSessionId } = useClerkAuth();
  const location = useLocation();
  return (
    <RegisterPageView
      clerkLoaded={clerkLoaded}
      clerkSignedIn={clerkSignedIn}
      clerkSessionId={clerkSessionId}
      pathname={location.pathname}
    />
  );
}

function RegisterPageView({
  clerkLoaded,
  clerkSignedIn,
  clerkSessionId = null,
  pathname = '/register',
}) {
  const { user, loading: authLoading, sessionReady, bootError, retryBoot } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navigatedRef = useRef(false);
  const [establishError, setEstablishError] = useState(null);
  const clerkReady = isClerkConfigured();

  const uiState = computeLoginUiState({
    clerkReady,
    clerkLoaded,
    clerkSignedIn,
    clerkSessionId,
    pathname,
    authLoading,
    user,
    sessionReady,
    establishError,
    bootError,
  });

  useEffect(() => {
    resetNavigateGuard();
  }, []);

  useEffect(() => {
    return subscribeClerkEstablishError(setEstablishError);
  }, []);

  useEffect(() => {
    if (uiState !== 'REDIRECTING') {
      navigatedRef.current = false;
      return;
    }
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    const target = resolveLoginReturnPath({
      stateFrom: location.state?.from,
      search: location.search,
    });
    navigateOnce(navigate, target);
  }, [uiState, navigate, location.state, location.search]);

  if (uiState === 'BOOT_ERROR') {
    return (
      <>
        <AppBootError bootError={bootError} onRefresh={() => retryBoot()} />
        <ClearSessionCookiesButton bootError stuckLogin className="mt-4" />
      </>
    );
  }

  if (uiState === 'BOOT_LOADING' || uiState === 'ESTABLISHING' || uiState === 'REDIRECTING') {
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

  const showEstablishError = uiState === 'ESTABLISH_ERROR';

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
        <>
          {showEstablishError && (
            <p className="mb-3 text-sm text-red-200 text-center" role="alert">
              {establishError?.message || 'Could not finish sign-up.'}
              {establishError?.stage ? ` (${establishError.stage})` : ''}
            </p>
          )}
          <ClerkSignUpBlock />
          {showEstablishError ? (
            <ClearSessionCookiesButton stuckLogin className="mt-4" />
          ) : (
            <ClearSessionCookiesButton bootError={Boolean(bootError)} />
          )}
        </>
      )}
    </AuthMarketingShell>
  );
}
