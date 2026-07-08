/**
 * Client-side mutation retry queue — replays failed writes when back online.
 * ponytail: in-memory; persist later if offline editing becomes common.
 */

const queue = [];
let flushing = false;
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => {
    try { fn(queue.length); } catch { /* ignore */ }
  });
}

export function getBackgroundQueueLength() {
  return queue.length;
}

export function subscribeBackgroundQueue(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * @param {() => Promise<unknown>} run
 * @param {{ label?: string, maxRetries?: number }} [options]
 */
export function enqueueBackgroundMutation(run, options = {}) {
  const { label = 'sync', maxRetries = 3 } = options;
  queue.push({ run, label, retries: 0, maxRetries });
  notify();
  void flushBackgroundMutationQueue();
}

export async function flushBackgroundMutationQueue() {
  if (flushing || queue.length === 0) return;
  flushing = true;
  try {
    while (queue.length > 0) {
      const item = queue[0];
      try {
        await item.run();
        queue.shift();
        notify();
      } catch {
        item.retries += 1;
        if (item.retries >= item.maxRetries) {
          queue.shift();
          notify();
        }
        break;
      }
    }
  } finally {
    flushing = false;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void flushBackgroundMutationQueue();
  });
}
