import React from 'react';
import { GoogleOneTap } from '@clerk/react';
import { useLocation } from 'react-router-dom';
import { isClerkConfigured } from '../../config/clerk';
import { resolveClerkForceRedirectUrl } from '../../config/siteUrls';
import { isPublicThemeRoute } from '../../lib/publicRouteTheme';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Google One Tap prompt for Clerk sign-in/sign-up on public auth routes.
 * Clerk hides the UI when the user already has a Clerk session.
 */
export default function ClerkGoogleOneTap() {
  if (!isClerkConfigured()) return null;
  return <ClerkGoogleOneTapInner />;
}

function ClerkGoogleOneTapInner() {
  const { pathname } = useLocation();
  const { user, loading: authLoading } = useAuth();

  if (authLoading || user) return null;
  if (!isPublicThemeRoute(pathname)) return null;

  const clerkRedirect = resolveClerkForceRedirectUrl();

  return (
    <GoogleOneTap
      signInForceRedirectUrl={clerkRedirect}
      signUpForceRedirectUrl={clerkRedirect}
    />
  );
}
