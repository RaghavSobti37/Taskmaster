import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOrgOptional } from '../contexts/OrgContext';
import { isOrgSlugRoutesEnabled, orgPath } from '../lib/orgPaths';

const GLOBAL_PREFIXES = [
  '/org',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/landing',
  '/privacy',
  '/terms',
  '/userdata',
  '/oauth',
  '/invites',
  '/preview',
  '/artist',
  '/artist-workspace',
  '/unsubscribe',
  '/auth',
  '/relegends',
];

const isGlobalPath = (path) => {
  const normalized = (path || '').startsWith('/') ? path : `/${path || ''}`;
  return GLOBAL_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
};

/** Resolve in-app paths with active org slug prefix when slug routing is enabled. */
export function useOrgPath() {
  const { orgSlug: paramSlug } = useParams();
  const org = useOrgOptional();
  const { user } = useAuth();
  const slug = paramSlug || org?.orgSlug || user?.activeTenantSlug;

  return useCallback((path = '/dashboard') => {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    if (!isOrgSlugRoutesEnabled()) {
      return normalized;
    }
    if (isGlobalPath(normalized)) {
      return normalized;
    }
    return orgPath(slug, normalized);
  }, [slug]);
}

export function useActiveOrgSlug() {
  const { orgSlug: paramSlug } = useParams();
  const org = useOrgOptional();
  const { user } = useAuth();
  return paramSlug || org?.orgSlug || user?.activeTenantSlug || null;
}
