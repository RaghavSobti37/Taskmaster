/** Online/offline sync status bus — decoupled from UI framework. */

export const SYNC_STATUS = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  OFFLINE: 'offline',
  ERROR: 'error',
};

let status = SYNC_STATUS.IDLE;
const listeners = new Set();

export function getSyncStatus() {
  return status;
}

export function subscribeSyncStatus(listener) {
  listeners.add(listener);
  listener(status);
  return () => listeners.delete(listener);
}

function setStatus(next) {
  if (status === next) return;
  status = next;
  for (const listener of listeners) listener(status);
}

export function createSyncLifecycle({ connect }) {
  const onOnline = () => {
    setStatus(SYNC_STATUS.CONNECTING);
    connect()
      .then(() => setStatus(SYNC_STATUS.SYNCED))
      .catch(() => setStatus(SYNC_STATUS.ERROR));
  };

  const onOffline = () => setStatus(SYNC_STATUS.OFFLINE);

  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    if (!navigator.onLine) onOffline();
    else onOnline();
  }

  return {
    getStatus: getSyncStatus,
    subscribe: subscribeSyncStatus,
    dispose() {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      }
      listeners.clear();
      status = SYNC_STATUS.IDLE;
    },
  };
}
