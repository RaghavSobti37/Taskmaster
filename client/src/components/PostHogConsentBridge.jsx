import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { hasAnalyticsConsent } from '../lib/cookieConsent';
import {
  ensurePostHogForConsent,
  isPostHogEnabled,
  setPostHogUser,
} from '../lib/posthog';

/** Keeps prior cookie acceptors identified once PostHog boots on any subdomain. */
export default function PostHogConsentBridge() {
  const { user, sessionReady } = useAuth();

  useEffect(() => {
    const sync = () => {
      if (!hasAnalyticsConsent()) return;
      ensurePostHogForConsent();
      if (user && isPostHogEnabled()) {
        setPostHogUser(user);
      }
    };

    sync();
    window.addEventListener('coreknot:cookie-consent', sync);
    window.addEventListener('coreknot:posthog-ready', sync);
    return () => {
      window.removeEventListener('coreknot:cookie-consent', sync);
      window.removeEventListener('coreknot:posthog-ready', sync);
    };
  }, [user, sessionReady]);

  return null;
}
