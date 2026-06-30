/**
 * PostHog UI deep links (admin dashboard widget).
 * Capture uses VITE_POSTHOG_PROJECT_TOKEN — this module only opens the PostHog app.
 */

const trim = (value) => String(value || '').trim();

const resolveRegion = (host = '') => (
  host.toLowerCase().includes('eu') ? 'eu' : 'us'
);

export const posthogUiHost = (region = 'us') => (
  region === 'eu' ? 'https://eu.posthog.com' : 'https://us.posthog.com'
);

export const posthogIngestHost = (region = 'us') => (
  region === 'eu' ? 'https://eu.i.posthog.com' : 'https://us.i.posthog.com'
);

export function getPostHogRegion() {
  return resolveRegion(trim(import.meta.env.VITE_POSTHOG_HOST) || 'https://us.i.posthog.com');
}

/** Project home, activity, or explicit dashboard override from env. */
export function getPostHogDashboardUrl() {
  const explicit = trim(import.meta.env.VITE_POSTHOG_DASHBOARD_URL);
  if (explicit) return explicit;

  const region = getPostHogRegion();
  const base = posthogUiHost(region);
  const projectId = trim(import.meta.env.VITE_POSTHOG_PROJECT_ID);
  if (projectId) return `${base}/project/${projectId}`;

  return `${base}/home`;
}

export function isPostHogDashboardConfigured() {
  return Boolean(
    trim(import.meta.env.VITE_POSTHOG_DASHBOARD_URL)
    || trim(import.meta.env.VITE_POSTHOG_PROJECT_ID)
    || trim(import.meta.env.VITE_POSTHOG_PROJECT_TOKEN),
  );
}

export function openPostHogDashboard(url = getPostHogDashboardUrl()) {
  const href = trim(url);
  if (!href) return false;
  window.open(href, '_blank', 'noopener,noreferrer');
  return true;
}
