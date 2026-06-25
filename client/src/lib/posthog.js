import posthog from 'posthog-js';

let initialized = false;

const tracingHosts = () => {
  const hosts = new Set(['localhost']);
  if (typeof window !== 'undefined') {
    hosts.add(window.location.host);
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
  const token = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN?.trim();
  const host = import.meta.env.VITE_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com';
  if (!token || initialized) return false;

  posthog.init(token, {
    api_host: host,
    defaults: '2026-01-30',
    person_profiles: 'identified_only',
    capture_exceptions: true,
    __add_tracing_headers: tracingHosts(),
  });
  initialized = true;
  return true;
};

export const getPostHogClient = () => (initialized ? posthog : null);

export const isPostHogEnabled = () => initialized;

export const setPostHogUser = (user) => {
  if (!initialized || !user) return;
  const id = String(user._id || user.id || '');
  if (!id) return;
  posthog.identify(id, {
    email: user.email || undefined,
    name: user.name || undefined,
    role: user.role || undefined,
  });
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
