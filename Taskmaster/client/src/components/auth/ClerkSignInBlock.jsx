import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SignIn, useAuth as useClerkAuth } from '@clerk/react';
import { isClerkConfigured } from '../../config/clerk';
import { getClerkSignInRedirectProps } from '../../config/siteUrls';
import { isClerkReadyForCoreKnotEstablish, resolveClerkSignInPathname } from '../../lib/clerkSignInFlow';
import { Spinner } from '../ui/Spinner';
import {
  clerkAuthAppearance,
  clerkAuthLocalization,
  clerkAuthShellClass,
} from '../../config/clerkAppearance';

const linkClass =
  'text-[var(--brand-green)] font-medium hover:text-[var(--brand-teal-deep)] underline-offset-2 hover:underline transition-colors';

function ClerkSignInLoading() {
  return (
    <div className="flex min-h-[12rem] items-center justify-center py-8" aria-busy="true" aria-live="polite">
      <Spinner size="lg" />
    </div>
  );
}

export default function ClerkSignInBlock() {
  if (!isClerkConfigured()) return null;
  return <ClerkSignInInner />;
}

function ClerkSignInInner() {
  const { isLoaded, isSignedIn, sessionId } = useClerkAuth();
  const location = useLocation();
  const signInRedirectProps = useMemo(() => getClerkSignInRedirectProps(), []);
  const appearance = useMemo(() => clerkAuthAppearance, []);
  const localization = useMemo(() => clerkAuthLocalization, []);
  const signInPath = resolveClerkSignInPathname(location.pathname);
  const readyToHideSignIn = isClerkReadyForCoreKnotEstablish({
    pathname: signInPath,
    isLoaded,
    isSignedIn,
    sessionId,
  });

  if (readyToHideSignIn) {
    return null;
  }

  if (!isLoaded) {
    return (
      <div className={clerkAuthShellClass} data-clerk-sign-in-shell>
        <ClerkSignInLoading />
      </div>
    );
  }

  return (
    <div className={clerkAuthShellClass} data-clerk-sign-in-shell>
      <SignIn
        key="coreknot-sign-in"
        routing="path"
        path="/login"
        signUpUrl="/register"
        {...signInRedirectProps}
        appearance={appearance}
        localization={localization}
      />
      <div className="mt-2 text-center">
        <Link to="/forgot-password" className={linkClass}>
          Forgot password?
        </Link>
      </div>
    </div>
  );
}
