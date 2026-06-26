/** Main-thread bridge to SQLite worker. */

let worker = null;
let messageId = 0;
const pending = new Map();

function getWorker() {
  if (typeof Worker === 'undefined') {
    throw new Error('Web Workers are not available in this environment');
  }
  if (!worker) {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (event) => {
      const { id, ok, result, error } = event.data ?? {};
      const resolver = pending.get(id);
      if (!resolver) return;
      pending.delete(id);
      if (ok) resolver.resolve(result);
      else resolver.reject(new Error(error ?? 'Worker error'));
    };
    worker.onerror = (event) => {
      for (const [, resolver] of pending) {
        resolver.reject(new Error(event.message ?? 'Worker crashed'));
      }
      pending.clear();
    };
  }
  return worker;
}

function send(type, payload = {}) {
  const id = ++messageId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, type, payload });
  });
}

export async function initLocalDatabase() {
  return send('ping');
}

export async function localQuery(sql, params = []) {
  const { rows } = await send('query', { sql, params });
  return rows;
}

export async function localRun(sql, params = []) {
  return send('run', { sql, params });
}

export async function localExec(sql) {
  return send('exec', { sql });
}

export async function estimateStorageQuota() {
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    return navigator.storage.estimate();
  }
  return { quota: null, usage: null };
}
