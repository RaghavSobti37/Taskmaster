import React, { useMemo } from 'react';
import { SignIn, useAuth } from '@clerk/react';
import { isClerkConfigured } from '../../config/clerk';
import { resolveAppNavigationTarget } from '../../config/siteUrls';
import {
  clerkAuthAppearance,
  clerkAuthLocalization,
  clerkAuthShellClass,
} from '../../config/clerkAppearance';

function ClerkSignInSkeleton() {
  return (
    <div className="w-full space-y-4 animate-pulse" aria-hidden>
      <div className="h-7 rounded-lg bg-white/10" />
      <div className="h-4 w-2/3 rounded bg-white/5" />
      <div className="h-11 rounded-lg bg-white/10" />
      <div className="h-11 rounded-lg bg-white/8" />
      <div className="h-11 rounded-lg bg-teal-300/20" />
    </div>
  );
}

export default function ClerkSignInBlock() {
  if (!isClerkConfigured()) return null;
  return <ClerkSignInInner />;
}

function ClerkSignInInner() {
  const { isLoaded, isSignedIn } = useAuth();
  const dashboardRedirect = useMemo(
    () => resolveAppNavigationTarget('/dashboard'),
    [],
  );

  if (isLoaded && isSignedIn) {
    return null;
  }

  if (!isLoaded) {
    return (
      <div className={clerkAuthShellClass} data-clerk-sign-in-shell>
        <ClerkSignInSkeleton />
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
        fallbackRedirectUrl={dashboardRedirect}
        forceRedirectUrl={dashboardRedirect}
        appearance={clerkAuthAppearance}
        localization={clerkAuthLocalization}
      />
    </div>
  );
}
