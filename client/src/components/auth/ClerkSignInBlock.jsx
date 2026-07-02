import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { SignIn, useAuth } from '@clerk/react';
import { isClerkConfigured } from '../../config/clerk';
import { getClerkSignInRedirectProps } from '../../config/siteUrls';
import { isClerkReadyForCoreKnotEstablish, resolveClerkSignInPathname } from '../../lib/clerkSignInFlow';
import { Spinner } from '../ui/Spinner';
import {
  clerkAuthAppearance,
  clerkAuthLocalization,
  clerkAuthShellClass,
} from '../../config/clerkAppearance';

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
  const { isLoaded, isSignedIn, sessionId } = useAuth();
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
    </div>
  );
}
