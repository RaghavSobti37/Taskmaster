import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { queryClient } from './queryClient';

const PERSIST_KEY = 'coreknot-rq-cache-v1';
const MAX_AGE_MS = 1000 * 60 * 60 * 12;

/** Persist TanStack Query cache to localStorage for instant revisit loads. */
export function setupQueryPersistence() {
  if (typeof window === 'undefined') return;

  try {
    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: PERSIST_KEY,
      throttleTime: 1000,
    });

    persistQueryClient({
      queryClient,
      persister,
      maxAge: MAX_AGE_MS,
      dehydrateOptions: {
        shouldDehydrateQuery: (query) => {
          const root = Array.isArray(query.queryKey) ? query.queryKey[0] : null;
          return ['projects', 'tasks', 'leads', 'dashboard', 'notes'].includes(root);
        },
      },
    });
  } catch {
    /* quota / private mode */
  }
}
