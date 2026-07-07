import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOrgOptional } from '../contexts/OrgContext';
import { isOrgSlugRoutesEnabled, orgPath } from '../lib/orgPaths';

/** Resolve in-app paths with active org slug prefix when slug routing is enabled. */
export function useOrgPath() {
  const { orgSlug: paramSlug } = useParams();
  const org = useOrgOptional();
  const { user } = useAuth();
  const slug = paramSlug || org?.orgSlug || user?.activeTenantSlug;

  return useCallback((path = '/dashboard') => {
    if (!isOrgSlugRoutesEnabled()) {
      return path.startsWith('/') ? path : `/${path}`;
    }
    return orgPath(slug, path);
  }, [slug]);
}

export function useActiveOrgSlug() {
  const { orgSlug: paramSlug } = useParams();
  const org = useOrgOptional();
  const { user } = useAuth();
  return paramSlug || org?.orgSlug || user?.activeTenantSlug || null;
}
