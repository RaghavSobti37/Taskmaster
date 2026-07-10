import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export function useCrmStatsTrends({ days = 30, dateKey, enabled = true } = {}) {
  return useQuery({
    queryKey: ['admin', 'crm-stats', 'trends', days, dateKey || 'today'],
    queryFn: async () => {
      const params = { days };
      if (dateKey) params.dateKey = dateKey;
      return (await axios.get('/api/admin/crm-stats/trends', { params })).data.data;
    },
    staleTime: 60_000,
    enabled,
  });
}

export function useCrmStats({ days = 1, dateKey, enabled = true } = {}) {
  return useQuery({
    queryKey: ['admin', 'crm-stats', days, dateKey || 'today'],
    queryFn: async () => {
      const params = { days };
      if (dateKey) params.dateKey = dateKey;
      return (await axios.get('/api/admin/crm-stats', { params })).data.data;
    },
    staleTime: 60_000,
    enabled,
  });
}
