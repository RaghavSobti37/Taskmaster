import { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  clearPostHogUser,
  ensurePostHogForConsent,
  isPostHogEnabled,
  setPostHogUser,
} from '../../lib/posthog';
import { isPostHogConfigured } from '../../config/posthog';

/** Pageview + identify bridge for dashboard widgets (PostHogProvider lives in main.jsx). */
export default function PostHogAnalytics() {
  const { user } = useAuth();

  useEffect(() => {
    if (!isPostHogConfigured()) return undefined;

    const onConsent = () => {
      ensurePostHogForConsent();
    };

    onConsent();
    window.addEventListener('coreknot:cookie-consent', onConsent);
    return () => window.removeEventListener('coreknot:cookie-consent', onConsent);
  }, []);

  useEffect(() => {
    if (!isPostHogConfigured() || !isPostHogEnabled()) return;
    if (user) {
      setPostHogUser(user);
    } else {
      clearPostHogUser();
    }
  }, [user]);

  return null;
}
