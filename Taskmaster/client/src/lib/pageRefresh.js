import { refetchUserScopedQueries } from './queryInvalidation';
import { connectSyncEngine } from './localFirstBootstrap';

/** Mobile pull-to-refresh: invalidate user caches + refetch active queries + optional sync. */
export async function refreshMobilePage(queryClient) {
  refetchUserScopedQueries(queryClient);
  await queryClient.refetchQueries({ type: 'active', stale: true });
  try {
    await connectSyncEngine();
  } catch {
    // ponytail: local-first sync is optional
  }
}
