import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

export const UNLOCK_ALL = true;

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
  return data ?? {};
};

export function useTenantUnlocks() {
  const { user } = useAuth();
  const tenantId = user?.activeTenantId || user?.tenantId;

  const query = useQuery({
    queryKey: ['tenantUnlocks', tenantId],
    queryFn: () => fetchTenantUnlocks(tenantId),
    enabled: Boolean(tenantId),
    staleTime: 60_000,
  });

  const isFeatureUnlocked = () => true;
  const getFeatureLock = () => null;
  const getFeatureLockByKey = () => null;

  return {
    unlocks: ALL_UNLOCKED,
    locks: {},
    plan: query.data?.plan || user?.activeTenant?.plan || user?.tenant?.plan || 'free',
    limits: query.data?.limits,
    isLoading: query.isLoading,
    refetch: query.refetch,
    isFeatureUnlocked,
    getFeatureLock,
    getFeatureLockByKey,
  };
}
