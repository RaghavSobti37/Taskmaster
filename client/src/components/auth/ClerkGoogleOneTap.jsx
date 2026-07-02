import React from 'react';
import { GoogleOneTap } from '@clerk/react';
import { useLocation } from 'react-router-dom';
import { isClerkConfigured } from '../../config/clerk';
import { getClerkSignInRedirectProps } from '../../config/siteUrls';
import { isClerkSignInSubflowPath, resolveClerkSignInPathname } from '../../lib/clerkSignInFlow';
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

  const suppressOneTap = (() => {
    try {
      const raw = sessionStorage.getItem('coreknot_just_logged_out');
      if (!raw) return false;
      const ts = Number(raw);
      return Number.isFinite(ts) && Date.now() - ts < 10_000;
    } catch {
      return false;
    }
  })();

  if (authLoading || user || suppressOneTap) return null;
  if (!isPublicThemeRoute(pathname)) return null;

  const signInPath = resolveClerkSignInPathname(pathname);
  if (isClerkSignInSubflowPath(signInPath)) return null;

  const oneTapRedirectProps = getClerkSignInRedirectProps();

  return (
    <GoogleOneTap
      {...oneTapRedirectProps}
    />
  );
}
