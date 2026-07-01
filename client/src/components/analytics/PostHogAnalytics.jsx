import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  capturePostHogEvent,
  clearPostHogUser,
  ensurePostHogForConsent,
  isPostHogEnabled,
  setPostHogUser,
} from '../../lib/posthog';
import { isPostHogConfigured } from '../../config/posthog';

/** Pageview + identify bridge for dashboard widgets (PostHogProvider lives in main.jsx). */
export default function PostHogAnalytics() {
  const { pathname } = useLocation();
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

  useEffect(() => {
    if (!isPostHogConfigured() || !isPostHogEnabled()) return;
    capturePostHogEvent('$pageview', { $current_url: pathname });
  }, [pathname]);

  return null;
}
