/** Org slug URL helpers — default slug-prefixed routes enabled. */

export const RESERVED_ORG_SLUGS = new Set([
  'login',
  'register',
  'org',
  'artist',
  'invites',
  'privacy',
  'terms',
  'userdata',
  'oauth',
  'preview',
  'unsubscribe',
  'landing',
  'api',
  'upgrade',
  'workspace',
  'workspaces',
  'auth',
  'relegends',
  'forgot-password',
  'reset-password',
]);

export function isOrgSlugRoutesEnabled() {
  return import.meta.env.VITE_ORG_SLUG_ROUTES !== 'false';
}

export function orgPath(slug, path = '/dashboard') {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  if (!isOrgSlugRoutesEnabled()) return suffix;
  const cleanSlug = String(slug || '').trim();
  if (!cleanSlug) return suffix;
  return `/${cleanSlug}${suffix}`;
}

export function orgPathFromUser(user, path = '/dashboard') {
  const slug = user?.activeTenantSlug;
  const tenantId = user?.activeTenantId || user?.tenantId;
  if (slug) return orgPath(slug, path);
  if (tenantId && user?.memberships?.length) {
    const match = user.memberships.find(
      (m) => String(m.tenant?._id || m.tenant) === String(tenantId),
    );
    if (match?.tenant?.slug) return orgPath(match.tenant.slug, path);
  }
  return path.startsWith('/') ? path : `/${path}`;
}

export function stripOrgPrefix(pathname, orgSlug) {
  if (!orgSlug || !pathname) return pathname || '/dashboard';
  const prefix = `/${orgSlug}`;
  if (pathname === prefix) return '/dashboard';
  if (pathname.startsWith(`${prefix}/`)) {
    return pathname.slice(prefix.length) || '/dashboard';
  }
  return pathname;
}

export function isReservedOrgSlug(slug) {
  const normalized = String(slug || '').trim().toLowerCase();
  return !normalized || RESERVED_ORG_SLUGS.has(normalized);
}

/** Flat app paths that redirect into slug-prefixed routes when enabled. */
export const LEGACY_ORG_APP_PATHS = [
  '/dashboard',
  '/projects',
  '/workspaces',
  '/calendar',
  '/settings',
  '/logs',
  '/attendance',
  '/schedule',
  '/inbox',
  '/todo',
  '/notes',
  '/crm',
  '/office',
  '/management',
  '/admin',
  '/assets',
  '/office-assets',
  '/features',
  '/workflows',
  '/developers',
  '/emails',
  '/finance',
  '/leads',
  '/followups',
  '/bookings',
  '/equipment',
  '/contacts',
  '/subscriptions',
  '/announcements',
  '/documents',
  '/artists',
  '/upgrade',
];
