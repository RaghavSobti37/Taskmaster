import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AppBootError from '../../components/AppBootError';
import BootScreen from '../../components/BootScreen';
import AuthMarketingShell from '../../components/auth/AuthMarketingShell';
import ClerkSignInBlock from '../../components/auth/ClerkSignInBlock';
import InstallGuideModal from '../../components/auth/InstallGuideModal';
import { detectInstallPlatform } from '../../utils/installPlatform';
import { isClerkConfigured } from '../../config/clerk';
import { loginCopy } from '../../constants/marketingContent';
import { consumeAuthReturnPath } from '../../lib/authUnauthorized';
import { resolveLoginReturnPath } from '../../utils/loginReturnPath';
import { navigateAfterAuth } from '../../utils/authNavigation';

const linkClass =
  'text-[var(--brand-green)] font-medium hover:text-[var(--brand-teal-deep)] underline-offset-2 hover:underline transition-colors';

export default function LoginPage() {
  const { user, loading: authLoading, bootError, retryBoot } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [installGuideOpen, setInstallGuideOpen] = React.useState(false);
  const installPlatform = React.useMemo(() => detectInstallPlatform(), [installGuideOpen]);
  const clerkReady = isClerkConfigured();

  const resolveReturnPath = React.useCallback(
    () => resolveLoginReturnPath({
      stateFrom: location.state?.from,
      search: location.search,
      storedReturnPath: consumeAuthReturnPath(),
    }),
    [location.state, location.search],
  );

  useEffect(() => {
    if (!authLoading && user) {
      navigateAfterAuth(navigate, resolveReturnPath());
    }
  }, [authLoading, user, navigate, resolveReturnPath]);

  if (bootError) {
    return <AppBootError message={bootError} onRefresh={() => retryBoot()} />;
  }

  if (authLoading) {
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
