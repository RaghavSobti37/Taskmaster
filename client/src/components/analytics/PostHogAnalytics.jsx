import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  capturePostHogPageview,
  identifyPostHogUser,
  initPostHog,
  resetPostHogUser,
  syncPostHogConsent,
} from '../../lib/posthogClient';
import { isPostHogConfigured } from '../../config/posthog';

/**
 * Initializes PostHog after analytics consent; tracks pageviews and identifies signed-in users.
 */
export default function PostHogAnalytics() {
  const { pathname } = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (!isPostHogConfigured()) return undefined;

    const onConsent = () => {
      initPostHog();
      syncPostHogConsent();
    };

    onConsent();
    window.addEventListener('coreknot:cookie-consent', onConsent);
    return () => window.removeEventListener('coreknot:cookie-consent', onConsent);
  }, []);

  useEffect(() => {
    if (!isPostHogConfigured()) return;
    if (user) {
      identifyPostHogUser(user);
    } else {
      resetPostHogUser();
    }
  }, [user]);

  useEffect(() => {
    capturePostHogPageview(pathname);
  }, [pathname]);

  return null;
}
