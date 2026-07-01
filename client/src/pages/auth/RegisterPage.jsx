import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AuthMarketingShell from '../../components/auth/AuthMarketingShell';
import ClerkSignUpBlock from '../../components/auth/ClerkSignUpBlock';
import { isClerkConfigured } from '../../config/clerk';
import { registerCopy } from '../../constants/marketingContent';
import { navigateAfterAuth } from '../../utils/authNavigation';

const linkClass =
  'text-[var(--brand-green)] font-medium hover:text-[var(--brand-teal-deep)] underline-offset-2 hover:underline transition-colors';

export default function RegisterPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const clerkReady = isClerkConfigured();

  useEffect(() => {
    if (!authLoading && user) {
      navigateAfterAuth(navigate, '/dashboard');
    }
  }, [authLoading, user, navigate]);

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
