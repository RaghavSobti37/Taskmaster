import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const fetchAdminConsoleSummary = async () => {
  const { data } = await axios.get('/api/admin/console/summary', { withCredentials: true });
  return data;
};

export function useAdminConsoleSummary(enabled = true) {
  return useQuery({
    queryKey: ['adminConsoleSummary'],
    queryFn: fetchAdminConsoleSummary,
    enabled,
    staleTime: 30_000,
  });
}
