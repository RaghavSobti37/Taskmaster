import React from 'react';
import { SignUp } from '@clerk/clerk-react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import MarketingPageBackground from '../../components/MarketingPageBackground';
import BrandLogo from '../../components/brand/BrandLogo';
import AppBootFallback from '../../components/AppBootFallback';
import useClerkSessionExchange from '../../components/auth/useClerkSessionExchange';
import { registerCopy } from '../../constants/marketingContent';
import { clerkAppearance } from '../../lib/clerkAppearance';
import { navigateAfterAuth } from '../../utils/authNavigation';

export default function ClerkRegisterPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const { error, exchanging } = useClerkSessionExchange({
    onSuccess: () => navigateAfterAuth(navigate, '/dashboard'),
  });

  React.useEffect(() => {
    if (!authLoading && user) {
      navigateAfterAuth(navigate, '/dashboard');
    }
  }, [authLoading, user, navigate]);

  if (authLoading || exchanging) {
    return <AppBootFallback />;
  }

  return (
    <div className="tm-marketing-page min-h-screen bg-background text-foreground relative overflow-hidden grid place-items-center p-6">
      <MarketingPageBackground />
      <div className="tm-modal-panel max-w-md relative z-10 bg-card p-8 rounded-3xl border border-border shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="text-center mb-8">
          <BrandLogo size={64} className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{registerCopy.title}</h1>
          <p className="text-[var(--color-text-secondary)] mt-2 font-medium">{registerCopy.subtitle}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl font-medium flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <SignUp
          routing="path"
          path="/register"
          signInUrl="/login"
          forceRedirectUrl="/dashboard"
          appearance={clerkAppearance}
        />

        <div className="mt-6 text-center text-sm text-[var(--color-text-muted)] font-medium">
          Already have an account?{' '}
          <Link to="/login" className="text-[var(--color-brand-teal)] font-bold hover:underline">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
