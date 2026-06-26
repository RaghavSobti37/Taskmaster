import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isStaleChunkError,
  isStaleAssetScript,
  recoverFromStaleChunks,
  markChunkRecoveryComplete,
} from './chunkRecovery';

describe('chunkRecovery', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('detects stale dynamic import errors', () => {
    expect(isStaleChunkError(new Error('Failed to fetch dynamically imported module: foo.js'))).toBe(true);
    expect(isStaleChunkError(new Error('MIME type of "text/html"'))).toBe(true);
    expect(isStaleChunkError(new Error('network down'))).toBe(false);
  });

  it('detects stale script tags', () => {
    expect(isStaleAssetScript({ tagName: 'SCRIPT', src: 'https://x.com/a.js' })).toBe(true);
    expect(isStaleAssetScript({ tagName: 'LINK', src: 'https://x.com/a.css' })).toBe(false);
  });

  it('limits recovery attempts', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });

    sessionStorage.setItem('coreknot-chunk-recovery', JSON.stringify({ attempts: 2 }));
    const recovered = await recoverFromStaleChunks();
    expect(recovered).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('clears recovery marker when app boots cleanly', () => {
    sessionStorage.setItem('coreknot-chunk-recovery', JSON.stringify({ attempts: 1 }));
    markChunkRecoveryComplete();
    expect(sessionStorage.getItem('coreknot-chunk-recovery')).toBeNull();
  });
});
