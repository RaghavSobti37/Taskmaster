import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth as useClerkAuth } from '@clerk/react';
import { useAuth } from '../../contexts/AuthContext';
import AppBootError from '../../components/AppBootError';
import BootScreen from '../../components/BootScreen';
import AuthMarketingShell from '../../components/auth/AuthMarketingShell';
import ClerkSignInBlock from '../../components/auth/ClerkSignInBlock';
import ClearSessionCookiesButton from '../../components/auth/ClearSessionCookiesButton';
import InstallGuideModal from '../../components/auth/InstallGuideModal';
import { detectInstallPlatform } from '../../utils/installPlatform';
import { isClerkConfigured } from '../../config/clerk';
import { loginCopy } from '../../constants/marketingContent';
import { resolveLoginReturnPath } from '../../utils/loginReturnPath';
import { subscribeClerkEstablishError } from '../../lib/clerkEstablishRegistry';
import { computeLoginUiState, resolveClerkSignInPathname } from '../../lib/clerkSignInFlow';
import { navigateOnce, resetNavigateGuard } from '../../lib/postLoginRedirect';

const linkClass =
  'text-[var(--brand-green)] font-medium hover:text-[var(--brand-teal-deep)] underline-offset-2 hover:underline transition-colors';

/** ponytail: Clerk hooks only under ClerkProvider — CI preview builds omit publishable key */
export default function LoginPage() {
  if (!isClerkConfigured()) {
    return <LoginPageView clerkLoaded clerkSignedIn={false} />;
  }
  return <LoginPageWithClerk />;
}

function LoginPageWithClerk() {
  const {
    isLoaded: clerkLoaded,
    isSignedIn: clerkSignedIn,
    sessionId: clerkSessionId,
  } = useClerkAuth();
  const location = useLocation();
  return (
    <LoginPageView
      clerkLoaded={clerkLoaded}
      clerkSignedIn={clerkSignedIn}
      clerkSessionId={clerkSessionId}
      pathname={location.pathname}
    />
  );
}

function LoginPageView({
  clerkLoaded,
  clerkSignedIn,
  clerkSessionId = null,
  pathname = '/login',
}) {
  const { user, loading: authLoading, sessionReady, bootError, retryBoot } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navigatedRef = useRef(false);
  const [installGuideOpen, setInstallGuideOpen] = React.useState(false);
  const [establishError, setEstablishError] = useState(null);
  const installPlatform = React.useMemo(() => detectInstallPlatform(), [installGuideOpen]);
  const clerkReady = isClerkConfigured();

  const signInPath = resolveClerkSignInPathname(pathname || location.pathname);

  const uiState = computeLoginUiState({
    clerkReady,
    clerkLoaded,
    clerkSignedIn,
    clerkSessionId,
    pathname: signInPath,
    authLoading,
    user,
    sessionReady,
    establishError,
    bootError,
  });

  useEffect(() => {
    resetNavigateGuard();
  }, []);

  useEffect(() => subscribeClerkEstablishError(setEstablishError), []);

  useEffect(() => {
    if (uiState !== 'REDIRECTING') {
      navigatedRef.current = false;
      return;
    }
    if (authLoading || navigatedRef.current) return;
    navigatedRef.current = true;
    const target = resolveLoginReturnPath({
      stateFrom: location.state?.from,
      search: location.search,
    });
    navigateOnce(navigate, target);
  }, [uiState, authLoading, navigate, location.state, location.search]);

  const asideLinks = (
    <>
      <button type="button" onClick={() => setInstallGuideOpen(true)} className={linkClass}>
        {installPlatform.installed ? loginCopy.installCtaInstalled : 'Install app'}
      </button>
      <span className="text-[var(--brand-teal-mid)]/40" aria-hidden>·</span>
      <span className="text-[var(--brand-teal-mid)]">Need access?</span>
      <Link to="/register" className={linkClass}>
        Request invitation
      </Link>
    </>
  );

  if (uiState === 'BOOT_ERROR') {
    return (
      <>
        <AppBootError bootError={bootError} onRefresh={() => retryBoot()} />
        <ClearSessionCookiesButton bootError />
      </>
    );
  }

  if (uiState === 'BOOT_LOADING' || uiState === 'ESTABLISHING' || uiState === 'REDIRECTING') {
    return <BootScreen onRefresh={() => retryBoot()} />;
  }

  const showRecovery = uiState !== 'SHOW_SIGN_IN';

  return (
    <>
      <AuthMarketingShell subtitle={loginCopy.subtitle} asideLinks={asideLinks}>
        <h1 className="sr-only">CoreKnot login</h1>
        {!clerkReady ? (
          <p className="text-sm text-red-200 text-center">
            Clerk is not configured. Set <code className="text-xs">VITE_CLERK_PUBLISHABLE_KEY</code> in client env.
          </p>
        ) : (
          <>
            {uiState === 'ESTABLISH_ERROR' && establishError ? (
              <div
                className="mb-4 rounded-lg border border-red-400/40 bg-red-950/40 px-4 py-3 text-sm text-red-100 text-center"
                role="alert"
              >
                <p className="font-medium">Workspace session failed</p>
                <p className="mt-1 text-red-100/90">{establishError.message}</p>
                {establishError.stage ? (
                  <p className="mt-1 text-xs text-red-200/70">Stage: {establishError.stage}</p>
                ) : null}
                {establishError.debugCode ? (
                  <p className="mt-1 text-xs text-red-200/70">{establishError.debugCode}</p>
                ) : null}
              </div>
            ) : null}
            <ClerkSignInBlock />
          </>
        )}
        {showRecovery ? (
          <ClearSessionCookiesButton
            bootError={Boolean(bootError) || Boolean(establishError)}
            stuckLogin={uiState === 'ESTABLISH_ERROR'}
          />
        ) : (
          <ClearSessionCookiesButton bootError={false} />
        )}
      </AuthMarketingShell>
      <InstallGuideModal isOpen={installGuideOpen} onClose={() => setInstallGuideOpen(false)} />
    </>
  );
}
