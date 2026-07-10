import posthog from 'posthog-js';
import { postHogPersonPropertiesForUser } from '@shared/posthogInternalUsers';
import { hasAnalyticsConsent } from './cookieConsent';
import { shouldCapturePostHog } from '../config/posthog';

/** Same-origin proxy path when VITE_POSTHOG_USE_PROXY=true — else direct PostHog host. */
export const POSTHOG_PROXY_PATH = '/ph';

const isPostHogProxyEnabled = () => {
  const flag = import.meta.env.VITE_POSTHOG_USE_PROXY?.trim().toLowerCase();
  return flag === 'true' || flag === '1' || flag === 'yes';
};

let initialized = false;

const resolveRegion = (host = '') => (
  host.toLowerCase().includes('eu') ? 'eu' : 'us'
);

const posthogUiHost = (region) => (
  region === 'eu' ? 'https://eu.posthog.com' : 'https://us.posthog.com'
);

const tracingHosts = () => {
  const hosts = new Set();
  if (typeof window !== 'undefined') {
    hosts.add(window.location.host);
  }
  const appUrl = import.meta.env.VITE_POSTHOG_APP_URL?.trim();
  if (appUrl) {
    try {
      hosts.add(new URL(appUrl).host);
    } catch {
      /* ignore invalid VITE_POSTHOG_APP_URL */
    }
  }
  const apiUrl = import.meta.env.VITE_API_URL?.trim();
  if (apiUrl) {
    try {
      hosts.add(new URL(apiUrl).host);
    } catch {
      /* ignore invalid VITE_API_URL */
    }
  }
  return [...hosts];
};

export const initPostHog = () => {
  if (!shouldCapturePostHog()) return false;
  if (!hasAnalyticsConsent()) return false;

  const token = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN?.trim()
    || import.meta.env.VITE_POSTHOG_KEY?.trim();
  if (!token || initialized) return false;

  const remoteHost = import.meta.env.VITE_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com';
  const region = resolveRegion(remoteHost);
  // ponytail: direct PostHog by default — /ph Vercel edge proxy only when VITE_POSTHOG_USE_PROXY
  const apiHost = isPostHogProxyEnabled() ? POSTHOG_PROXY_PATH : remoteHost;

  posthog.init(token, {
    api_host: apiHost,
    ui_host: posthogUiHost(region),
    defaults: '2026-01-30',
    person_profiles: 'identified_only',
    capture_pageview: 'history_change',
    capture_exceptions: true,
    __add_tracing_headers: tracingHosts(),
  });
  initialized = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('coreknot:posthog-ready'));
  }
  return true;
};

/** Boot PostHog when prior consent exists (localStorage or shared cookie). */
export const ensurePostHogForConsent = () => {
  if (!hasAnalyticsConsent()) return false;
  return initPostHog();
};

export const getPostHogClient = () => (initialized ? posthog : null);

export const isPostHogEnabled = () => initialized;

export const setPostHogUser = (user) => {
  if (!initialized || !user) return;
  const id = String(user._id || user.id || '');
  if (!id) return;
  posthog.identify(id, postHogPersonPropertiesForUser(user));
  const tenantId = user.activeTenantId || user.tenantId;
  if (tenantId) {
    posthog.group('organization', String(tenantId));
  }
};

export const clearPostHogUser = () => {
  if (!initialized) return;
  posthog.reset();
};

export const capturePostHogEvent = (event, properties = {}) => {
  if (!initialized) return;
  posthog.capture(event, properties);
};

export const capturePostHogException = (error, context = {}) => {
  if (!initialized || !error) return;
  posthog.captureException(error, { extra: context });
};
