import React, { useEffect } from 'react';
import { GoogleOneTap } from '@clerk/react';
import { useLocation } from 'react-router-dom';
import { isClerkConfigured } from '../../config/clerk';
import { getClerkSignInRedirectProps } from '../../config/siteUrls';
import { isClerkSignInSubflowPath, resolveClerkSignInPathname } from '../../lib/clerkSignInFlow';
import { isPublicThemeRoute } from '../../lib/publicRouteTheme';
import { useAuth } from '../../contexts/AuthContext';

/** Duration (ms) to suppress One Tap after manual sign-out. */
const LOGOUT_SUPPRESS_MS = 30_000;

/** Ensures an element is not an empty div with zero dimensions. */
function isOneTapEmpty(node) {
  if (!node || !(node instanceof HTMLElement)) return false;
  const isIframe = node.tagName === 'IFRAME';
  // Clerk One Tap renders a zero-size iframe; treat that as busy
  if (isIframe) return false;
  const rect = node.getBoundingClientRect();
  return rect.width === 0 && rect.height === 0 && node.children.length === 0;
}

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

  // Check if user just logged out — suppress One Tap briefly
  const suppressOneTap = (() => {
    try {
      const raw = sessionStorage.getItem('coreknot_just_logged_out');
      if (!raw) return false;
      const ts = Number(raw);
      return Number.isFinite(ts) && Date.now() - ts < LOGOUT_SUPPRESS_MS;
    } catch {
      return false;
    }
  })();

  // Auto-clear the suppression flag after the window expires
  useEffect(() => {
    if (!suppressOneTap) return undefined;
    const remaining = (() => {
      try {
        const raw = sessionStorage.getItem('coreknot_just_logged_out');
        if (!raw) return 0;
        return Math.max(0, LOGOUT_SUPPRESS_MS - (Date.now() - Number(raw)));
      } catch {
        return 0;
      }
    })();
    if (remaining <= 0) {
      sessionStorage.removeItem('coreknot_just_logged_out');
      return undefined;
    }
    const timer = window.setTimeout(() => {
      try { sessionStorage.removeItem('coreknot_just_logged_out'); } catch { /* ignore */ }
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [suppressOneTap]);

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
