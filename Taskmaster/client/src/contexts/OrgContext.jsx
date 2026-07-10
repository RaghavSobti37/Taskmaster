import React, { createContext, useContext, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { orgQueryKey } from '../lib/orgQuery';
import { getNavFeatureLock } from '../utils/navPageAccess';

const OrgContext = createContext(null);

async function fetchOrgContext(orgSlug) {
  const { data } = await axios.get(
    `/api/orgs/${encodeURIComponent(orgSlug)}/context`,
    { params: { includeAllMemberships: 1 }, withCredentials: true },
  );
  return data;
}

export function OrgProvider({ orgSlug, children }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: orgQueryKey(orgSlug, 'context'),
    queryFn: () => fetchOrgContext(orgSlug),
    enabled: Boolean(orgSlug),
    staleTime: 60_000,
  });

  const value = useMemo(() => {
    const data = query.data;
    const unlocks = data?.featureUnlocks || {};
    const locks = data?.locks || {};

    const isFeatureUnlocked = (featureKey) => {
      if (!featureKey) return true;
      return Boolean(unlocks[featureKey]);
    };

    const getFeatureLockByKey = (featureKey) => {
      if (!featureKey || isFeatureUnlocked(featureKey)) return null;
      return locks[featureKey] || {
        featureKey,
        reason: 'disabled',
        message: 'This feature is not enabled for your organization.',
      };
    };

    return {
      orgSlug,
      tenant: data?.tenant || null,
      membership: data?.membership || null,
      memberships: data?.memberships || [],
      permissions: data?.permissions || {},
      featureUnlocks: unlocks,
      locks,
      onboarding: data?.onboarding || null,
      plan: data?.plan || data?.tenant?.plan || 'free',
      limits: data?.limits,
      activeTenantId: data?.activeTenantId || data?.tenant?._id || null,
      isLoading: query.isLoading,
      isReady: Boolean(data?.tenant),
      error: query.error,
      refetch: query.refetch,
      invalidate: () => queryClient.invalidateQueries({ queryKey: orgQueryKey(orgSlug, 'context') }),
      isFeatureUnlocked,
      getFeatureLock: (path) => getNavFeatureLock(path, { unlocks, locks }),
      getFeatureLockByKey,
    };
  }, [orgSlug, query.data, query.error, query.isLoading, query.refetch, queryClient]);

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  return useContext(OrgContext);
}

export function useOrgOptional() {
  return useContext(OrgContext);
}
