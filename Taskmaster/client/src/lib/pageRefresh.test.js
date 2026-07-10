import { describe, it, expect, vi, beforeEach } from 'vitest';
import { refreshMobilePage } from './pageRefresh';
import { refetchUserScopedQueries } from './queryInvalidation';
import { connectSyncEngine } from './localFirstBootstrap';

vi.mock('./queryInvalidation', () => ({
  refetchUserScopedQueries: vi.fn(),
}));

vi.mock('./localFirstBootstrap', () => ({
  connectSyncEngine: vi.fn().mockResolvedValue(null),
}));

describe('refreshMobilePage', () => {
  const queryClient = {
    refetchQueries: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invalidates user caches, refetches active queries, and reconnects sync', async () => {
    await refreshMobilePage(queryClient);

    expect(refetchUserScopedQueries).toHaveBeenCalledWith(queryClient);
    expect(queryClient.refetchQueries).toHaveBeenCalledWith({
      type: 'active',
      stale: true,
    });
    expect(connectSyncEngine).toHaveBeenCalled();
  });

  it('still completes when sync reconnect fails', async () => {
    connectSyncEngine.mockRejectedValueOnce(new Error('offline'));

    await expect(refreshMobilePage(queryClient)).resolves.toBeUndefined();
    expect(queryClient.refetchQueries).toHaveBeenCalled();
  });
});
