import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export const SYSTEM_HEALTH_REFRESH_MS = 30_000;

export const useSystemHealth = (options = {}) => {
  const enabled = options.enabled !== false;
  const poll = options.poll !== false;

  return useQuery({
    queryKey: ['admin', 'system-health'],
    queryFn: async () => {
      const { data } = await axios.get('/api/admin/system-health');
      return data?.data ?? data;
    },
    enabled,
    staleTime: 10_000,
    refetchInterval: poll ? SYSTEM_HEALTH_REFRESH_MS : false,
    refetchOnWindowFocus: true,
  });
};
