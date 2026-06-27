import { useEffect, useState } from 'react';

/**
 * Defer mounting until idle (or timeout). ponytail: one hook for staggered UI.
 * @param {{ timeoutMs?: number, delayMs?: number }} [options]
 */
export function useDeferredMount(options = {}) {
  const { timeoutMs = 1500, delayMs = 300 } = options;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const enable = () => setReady(true);
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(enable, { timeout: timeoutMs });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(enable, delayMs);
    return () => window.clearTimeout(timer);
  }, [timeoutMs, delayMs]);

  return ready;
}

/** Staggered tiers for progressive sections (0 = soonest). */
export function useDeferredMountTier(tier = 0, baseDelayMs = 300) {
  const timeoutMs = 1500 + tier * 1200;
  const delayMs = baseDelayMs + tier * 400;
  return useDeferredMount({ timeoutMs, delayMs });
}
