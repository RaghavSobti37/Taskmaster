import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createLazyWithRetry } from './lazyWithRetry';
import * as chunkRecovery from './chunkRecovery';

describe('createLazyWithRetry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rethrows chunk errors when recovery is exhausted', async () => {
    const chunkError = new Error('Failed to fetch dynamically imported module: /a.js');
    vi.spyOn(chunkRecovery, 'recoverFromStaleChunks').mockResolvedValue(false);

    const Lazy = createLazyWithRetry(() => Promise.reject(chunkError));

    await expect(Lazy._payload._result).rejects.toThrow(/dynamically imported module/i);
  });
});
