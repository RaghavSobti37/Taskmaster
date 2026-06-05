import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useDebounce } from './useDebounce';

export function useUnifiedSearch(query, { enabled = true, debounceMs = 300, limit = 12 } = {}) {
  const debouncedQ = useDebounce((query || '').trim(), debounceMs);
  const canSearch = enabled && debouncedQ.length >= 2;

  return useQuery({
    queryKey: ['unifiedSearch', debouncedQ, limit],
    queryFn: async () => {
      const { data } = await axios.get('/api/search', {
        params: { q: debouncedQ, limit },
      });
      return data;
    },
    enabled: canSearch,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}
