import { QueryClient, keepPreviousData } from '@tanstack/react-query';

/** GET responses stay fresh for 5 minutes before background revalidation. */
export const GET_STALE_TIME_MS = 5 * 60 * 1000;

/** Unused cache entries live 10 minutes (must be >= staleTime). */
export const GET_GC_TIME_MS = 10 * 60 * 1000;

const LIVE_QUERY_ROOTS = new Set(['notifications', 'statusCounts', 'attendance', 'inbox']);

/** Refetch on tab focus only for live data — reduces burst refetches on stable caches. */
export function shouldRefetchOnWindowFocus(query) {
  const root = Array.isArray(query?.queryKey) ? query.queryKey[0] : null;
  if (root === 'tasks' && query.queryKey[1] === 'review') return true;
  if (LIVE_QUERY_ROOTS.has(root)) return true;
  return false;
}

/**
 * Stale-while-revalidate defaults for all GET queries:
 * - Return cached data immediately (placeholderData: keepPreviousData).
 * - Within staleTime: no network request.
 * - After staleTime: serve cache, refetch in background on mount / reconnect.
 */
export const defaultQueryOptions = {
  staleTime: GET_STALE_TIME_MS,
  gcTime: GET_GC_TIME_MS,
  retry: 1,
  refetchOnMount: true,
  refetchOnWindowFocus: shouldRefetchOnWindowFocus,
  refetchOnReconnect: true,
  placeholderData: keepPreviousData,
};

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: defaultQueryOptions,
    },
  });
}

export const queryClient = createQueryClient();
