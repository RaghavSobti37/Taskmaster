/**
 * PostHog app + dashboard URLs (client). API token via VITE_POSTHOG_PROJECT_TOKEN.
 */

const trim = (value) => String(value || '').trim();

export const POSTHOG_PROJECT_ID_DEFAULT = '468825';

export function getPostHogHost() {
  return trim(import.meta.env.VITE_POSTHOG_HOST) || 'https://us.i.posthog.com';
}

export function getPostHogProjectId() {
  return trim(import.meta.env.VITE_POSTHOG_PROJECT_ID) || POSTHOG_PROJECT_ID_DEFAULT;
}

export function getPostHogProjectToken() {
  return trim(import.meta.env.VITE_POSTHOG_PROJECT_TOKEN)
    || trim(import.meta.env.VITE_POSTHOG_KEY);
}

/** PostHog web app (dashboards, insights, session replay). */
export function getPostHogAppUrl(path = '') {
  const explicit = trim(import.meta.env.VITE_POSTHOG_APP_URL);
  const base = explicit || `https://us.posthog.com/project/${getPostHogProjectId()}`;
  const suffix = trim(path).replace(/^\//, '');
  return suffix ? `${base.replace(/\/$/, '')}/${suffix}` : base;
}

export function isPostHogConfigured() {
  return Boolean(getPostHogProjectToken());
}

export function openPostHogDashboard(path = '') {
  const href = getPostHogAppUrl(path);
  if (!href) return false;
  window.open(href, '_blank', 'noopener,noreferrer');
  return true;
}
