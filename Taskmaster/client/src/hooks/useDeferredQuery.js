import { useDeferredMount } from './useDeferredMount';

/**
 * Gate react-query `enabled` until primary fetch is ready, then optionally idle.
 * @param {boolean} primaryReady
 * @param {{ idle?: boolean, tier?: number }} [options]
 */
export function useDeferredQueryEnabled(primaryReady, options = {}) {
  const { idle = true, tier = 0 } = options;
  const idleReady = useDeferredMount({
    timeoutMs: 1500 + tier * 1000,
    delayMs: 200 + tier * 300,
  });
  if (!primaryReady) return false;
  if (!idle) return true;
  return idleReady;
}
