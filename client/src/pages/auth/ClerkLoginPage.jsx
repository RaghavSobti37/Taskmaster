import React from 'react';
import { SignIn } from '@clerk/clerk-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { AlertCircle, Smartphone } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import MarketingPageBackground from '../../components/MarketingPageBackground';
import BrandLogo from '../../components/brand/BrandLogo';
import AppBootFallback from '../../components/AppBootFallback';
import useClerkSessionExchange from '../../components/auth/useClerkSessionExchange';
import InstallGuideModal from '../../components/auth/InstallGuideModal';
import { detectInstallPlatform } from '../../utils/installPlatform';
import { brand, loginCopy } from '../../constants/marketingContent';
import { clerkAppearance } from '../../lib/clerkAppearance';
import { resolveLoginReturnPath } from '../../utils/loginReturnPath';
import { consumeAuthReturnPath } from '../../lib/authUnauthorized';
import { navigateAfterAuth } from '../../utils/authNavigation';

export default function ClerkLoginPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [installGuideOpen, setInstallGuideOpen] = React.useState(false);
  const installPlatform = React.useMemo(() => detectInstallPlatform(), []);

  const resolveReturnPath = React.useCallback(
    () => resolveLoginReturnPath({
      stateFrom: location.state?.from,
      search: location.search,
      storedReturnPath: consumeAuthReturnPath(),
    }),
    [location.state, location.search],
  );

  const { error, exchanging } = useClerkSessionExchange({
    onSuccess: () => navigateAfterAuth(navigate, resolveReturnPath()),
  });

  React.useEffect(() => {
    if (!authLoading && user) {
      navigateAfterAuth(navigate, resolveReturnPath());
    }
  }, [authLoading, user, navigate, resolveReturnPath]);

  if (authLoading || exchanging) {
    return <AppBootFallback />;
  }

  return (
    <div className="tm-marketing-page min-h-screen bg-background text-foreground relative overflow-x-hidden overflow-y-auto grid place-items-center p-4 sm:p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <MarketingPageBackground inkClassName="opacity-40 mix-blend-multiply dark:mix-blend-screen dark:opacity-20" />
      <div className="tm-modal-panel tm-modal-sm max-w-md relative z-10 bg-card p-6 sm:p-8 rounded-3xl border border-border shadow-xl animate-in fade-in zoom-in-95 duration-300">
        <div className="text-center mb-6">
          <BrandLogo size={64} className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{brand.name}</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-3 px-1 leading-relaxed font-medium">
            {loginCopy.subtitle}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl font-medium flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <SignIn
          routing="path"
          path="/login"
          signUpUrl="/register"
          forceRedirectUrl={resolveReturnPath()}
          appearance={clerkAppearance}
        />

        <div className="mt-4 text-center text-sm space-y-3">
          <button
            type="button"
            onClick={() => setInstallGuideOpen(true)}
            className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-brand-teal)]/30 bg-[var(--color-brand-teal)]/5 px-4 py-2.5 text-sm font-semibold text-[var(--color-brand-teal)] hover:bg-[var(--color-brand-teal)]/10 transition-colors touch-manipulation"
          >
            <Smartphone size={16} />
            {installPlatform.installed ? loginCopy.installCtaInstalled : loginCopy.installCta}
          </button>
          <div className="flex items-center justify-center gap-2 text-[var(--color-text-muted)] font-medium">
            <span>New user?</span>
            <Link to="/register" className="text-[var(--color-brand-teal)] font-bold hover:underline inline-block">Register here</Link>
          </div>
          <div className="pt-3 border-t border-border flex items-center justify-center gap-4 text-xs text-[var(--color-text-muted)] font-medium">
            <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
            <span>•</span>
            <Link to="/userdata" className="hover:text-foreground">User Data Deletion</Link>
          </div>
        </div>
      </div>
      <InstallGuideModal isOpen={installGuideOpen} onClose={() => setInstallGuideOpen(false)} />
    </div>
  );
}
