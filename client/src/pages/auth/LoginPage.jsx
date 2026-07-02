import React, { useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth as useClerkAuth } from '@clerk/react';
import { useAuth } from '../../contexts/AuthContext';
import AppBootError from '../../components/AppBootError';
import BootScreen from '../../components/BootScreen';
import AuthMarketingShell from '../../components/auth/AuthMarketingShell';
import ClerkSignInBlock from '../../components/auth/ClerkSignInBlock';
import InstallGuideModal from '../../components/auth/InstallGuideModal';
import { detectInstallPlatform } from '../../utils/installPlatform';
import { isClerkConfigured } from '../../config/clerk';
import { loginCopy } from '../../constants/marketingContent';
import { navigateAfterAuth } from '../../utils/authNavigation';
import { resolveLoginReturnPath } from '../../utils/loginReturnPath';

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
  const { isLoaded: clerkLoaded, isSignedIn: clerkSignedIn } = useClerkAuth();
  return <LoginPageView clerkLoaded={clerkLoaded} clerkSignedIn={clerkSignedIn} />;
}

function LoginPageView({ clerkLoaded, clerkSignedIn }) {
  const { user, loading: authLoading, sessionReady, bootError, retryBoot } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navigatedRef = useRef(false);
  const [installGuideOpen, setInstallGuideOpen] = React.useState(false);
  const installPlatform = React.useMemo(() => detectInstallPlatform(), [installGuideOpen]);
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
      <button type="button" onClick={() => setInstallGuideOpen(true)} className={linkClass}>
        {installPlatform.installed ? loginCopy.installCtaInstalled : 'Install app'}
      </button>
      <span className="text-[var(--brand-teal-mid)]/40" aria-hidden>·</span>
      <span className="text-[var(--brand-teal-mid)]">New user?</span>
      <Link to="/register" className={linkClass}>
        Create account
      </Link>
    </>
  );

  return (
    <>
      <AuthMarketingShell subtitle={loginCopy.subtitle} asideLinks={asideLinks}>
        {!clerkReady ? (
          <p className="text-sm text-red-200 text-center">
            Clerk is not configured. Set <code className="text-xs">VITE_CLERK_PUBLISHABLE_KEY</code> in client env.
          </p>
        ) : (
          <ClerkSignInBlock />
        )}
      </AuthMarketingShell>
      <InstallGuideModal isOpen={installGuideOpen} onClose={() => setInstallGuideOpen(false)} />
    </>
  );
}
