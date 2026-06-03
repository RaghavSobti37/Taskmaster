import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export const STATUS_COUNTS_QUERY_KEY = ['statusCounts'];

export const useStatusCounts = (enabled = true) => {
  return useQuery({
    queryKey: STATUS_COUNTS_QUERY_KEY,
    queryFn: async () => (await axios.get('/api/notifications/status-counts')).data,
    enabled,
    staleTime: 1000 * 15,
    refetchInterval: 1000 * 30,
  });
};
