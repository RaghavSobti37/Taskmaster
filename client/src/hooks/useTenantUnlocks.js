import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { getNavFeatureLock } from '../utils/navPageAccess';

/** ponytail: flip false (or VITE_UNLOCK_ALL=false) when billing gates go live */
export const UNLOCK_ALL = import.meta.env.VITE_UNLOCK_ALL !== 'false';

export const TENANT_UNLOCK_KEYS = [
  'resend',
  'google',
  'meta',
  'knowledgeEngine',
  'finance',
  'artistOs',
];

const ALL_UNLOCKED = Object.fromEntries(TENANT_UNLOCK_KEYS.map((key) => [key, true]));

const fetchTenantUnlocks = async (tenantId) => {
  const { data } = await axios.get(`/api/tenants/${tenantId}/unlocks`, { withCredentials: true });
  return data?.unlocks ?? {};
};

export function useTenantUnlocks() {
  const { user } = useAuth();
  const tenantId = user?.activeTenantId || user?.tenantId;

  const query = useQuery({
    queryKey: ['tenantUnlocks', tenantId],
    queryFn: () => fetchTenantUnlocks(tenantId),
    enabled: Boolean(tenantId) && !UNLOCK_ALL,
    staleTime: 60_000,
  });

  const unlocks = UNLOCK_ALL ? ALL_UNLOCKED : (query.data ?? {});

  const isFeatureUnlocked = (featureKey) => {
    if (!featureKey) return true;
    if (UNLOCK_ALL) return true;
    return Boolean(unlocks[featureKey]);
  };

  const getFeatureLock = (path) => {
    if (UNLOCK_ALL) return null;
    return getNavFeatureLock(path, unlocks);
  };

  return {
    unlocks,
    isLoading: UNLOCK_ALL ? false : query.isLoading,
    isFeatureUnlocked,
    getFeatureLock,
  };
}
