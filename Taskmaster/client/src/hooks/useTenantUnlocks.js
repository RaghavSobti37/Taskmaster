import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useOrgOptional } from '../contexts/OrgContext';
import { orgQueryKey } from '../lib/orgQuery';
import { getNavFeatureLock } from '../utils/navPageAccess';
import { ORG_FEATURE_KEYS } from '@shared/orgFeatures';

export const UNLOCK_ALL = import.meta.env.VITE_FEATURE_UNLOCK_ALL === 'true';

const ALL_UNLOCKED = Object.fromEntries(ORG_FEATURE_KEYS.map((key) => [key, true]));
const ALL_LOCKED = Object.fromEntries(ORG_FEATURE_KEYS.map((key) => [key, false]));

const fetchTenantUnlocks = async (tenantId) => {
  const { data } = await axios.get(`/api/tenants/${tenantId}/unlocks`, { withCredentials: true });
  return data ?? {};
};

export function useTenantUnlocks() {
  const org = useOrgOptional();
  const { user } = useAuth();
  const tenantId = org?.activeTenantId || user?.activeTenantId || user?.tenantId;
  const orgSlug = org?.orgSlug;

  const query = useQuery({
    queryKey: orgSlug
      ? orgQueryKey(orgSlug, 'unlocks')
      : ['tenantUnlocks', tenantId],
    queryFn: () => fetchTenantUnlocks(tenantId),
    enabled: Boolean(tenantId) && !org?.isReady,
    staleTime: 60_000,
  });

  const unlocks = org?.isReady
    ? org.featureUnlocks
    : (UNLOCK_ALL ? ALL_UNLOCKED : (query.data?.unlocks || ALL_LOCKED));
  const locks = org?.isReady ? org.locks : (query.data?.locks || {});

  const isFeatureUnlocked = (featureKey) => {
    if (!featureKey || UNLOCK_ALL) return true;
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

  const getFeatureLock = (path) => getNavFeatureLock(path, { unlocks, locks });

  return {
    unlocks,
    locks,
    plan: org?.plan || query.data?.plan || user?.activeTenant?.plan || user?.tenant?.plan || 'free',
    limits: org?.limits || query.data?.limits,
    isLoading: org?.isReady ? false : query.isLoading,
    refetch: org?.refetch || query.refetch,
    isFeatureUnlocked,
    getFeatureLock,
    getFeatureLockByKey,
  };
}
