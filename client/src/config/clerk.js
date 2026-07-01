/**
 * Clerk app + dashboard URLs (client). API secret stays on Render only.
 */

const trim = (value) => String(value || '').trim();

/** ponytail: public org pin — env overrides for forks */
export const CLERK_ORGANIZATION_ID_DEFAULT = 'org_3FtSYDXVVjJQPtOg8LqhPYdeEdH';

export function getClerkPublishableKey() {
  return trim(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)
    || trim(import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
}

/** Clerk Frontend API host slug, e.g. glad-monkey-58.clerk.accounts.dev */
export function getClerkFrontendApiHost() {
  const explicit = trim(import.meta.env.VITE_CLERK_FRONTEND_API);
  if (explicit) return explicit.replace(/^https?:\/\//, '');
  const key = getClerkPublishableKey();
  if (!key.startsWith('pk_')) return '';
  try {
    let payload = key.replace(/^pk_(test|live)_/, '').replace(/\$/g, '');
    payload += '='.repeat((4 - (payload.length % 4)) % 4);
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    if (decoded.includes('.clerk.accounts.dev')) return decoded;
    if (decoded) return `${decoded}.clerk.accounts.dev`;
  } catch {
    // ignore decode errors
  }
  return '';
}

export function isClerkConfigured() {
  const key = getClerkPublishableKey();
  return Boolean(key && !key.includes('...'));
}

/** True when publishable key is production (`pk_live_`). */
export function isClerkLiveKey() {
  return getClerkPublishableKey().startsWith('pk_live_');
}

export function getClerkDashboardBaseUrl() {
  return trim(import.meta.env.VITE_CLERK_DASHBOARD_URL) || 'https://dashboard.clerk.com';
}

/** Optional path after dashboard host, e.g. apps/app_xxxx */
export function getClerkDashboardAppPath() {
  return trim(import.meta.env.VITE_CLERK_DASHBOARD_APP_PATH).replace(/^\//, '');
}

/**
 * Clerk Dashboard deep links (clerk/skills — use last-active?path=, not legacy /apps/... paths).
 * @see clerk-orgs SKILL.md "Dashboard shortcuts"
 */
export function getClerkDashboardUrl(subPath = '') {
  const base = getClerkDashboardBaseUrl().replace(/\/$/, '');
  const legacyAppPath = getClerkDashboardAppPath();
  const path = trim(subPath).replace(/^\//, '');

  // ponytail: optional legacy override for forks that still use apps/app_xxx paths
  if (legacyAppPath && !path) {
    return `${base}/${legacyAppPath.replace(/^\//, '')}`;
  }
  if (legacyAppPath && path) {
    return `${base}/${legacyAppPath.replace(/^\//, '')}/${path}`;
  }

  if (!path) return `${base}/last-active`;
  if (path.startsWith('~/')) return `${base}/${path}`;
  return `${base}/last-active?path=${encodeURIComponent(path)}`;
}

/** Pinned Clerk organization for this deployment (e.g. org_xxx for TSC). */
export function getPinnedClerkOrganizationId() {
  return trim(import.meta.env.VITE_CLERK_ORGANIZATION_ID)
    || trim(import.meta.env.NEXT_PUBLIC_CLERK_ORGANIZATION_ID)
    || CLERK_ORGANIZATION_ID_DEFAULT;
}

/** Dashboard links work with default clerk.com host even before publishable key is set. */
export function isClerkDashboardReady() {
  return Boolean(getClerkDashboardBaseUrl());
}

/** Quick links for Clerk dashboard widget (grouped like Render log streams). */
export function getClerkQuickLinks() {
  const orgId = getPinnedClerkOrganizationId();
  const orgSubtitle = orgId ? `${orgId.slice(0, 16)}…` : 'TSC org';
  return [
    { id: 'home', label: 'Dashboard', subtitle: 'App overview', path: '', group: 'users' },
    {
      id: 'organizations',
      label: 'The Shakti Collective',
      subtitle: orgSubtitle,
      path: orgId ? `organizations/${orgId}` : 'organizations',
      group: 'users',
    },
    {
      id: 'org-settings',
      label: 'Org settings',
      subtitle: 'Domains & roles',
      path: 'organizations-settings',
      group: 'users',
    },
    { id: 'users', label: 'Users', subtitle: 'Directory', path: 'users', group: 'users' },
    { id: 'sessions', label: 'Sessions', subtitle: 'Active sign-ins', path: 'sessions', group: 'users' },
    {
      id: 'email-auth',
      label: 'Email & password',
      subtitle: 'Sign-in / sign-up',
      path: 'user-authentication/email',
      group: 'users',
    },
    { id: 'api-keys', label: 'API keys', subtitle: 'pk_ / sk_', path: '~/api-keys', group: 'developer' },
    { id: 'jwt', label: 'JWT templates', subtitle: 'CoreKnot bridge', path: 'jwt-templates', group: 'developer' },
    { id: 'webhooks', label: 'Webhooks', subtitle: 'Event delivery', path: 'webhooks', group: 'developer' },
  ];
}

export function openClerkDashboard(subPath = '') {
  const href = getClerkDashboardUrl(subPath);
  if (!href) return false;
  window.open(href, '_blank', 'noopener,noreferrer');
  return true;
}
