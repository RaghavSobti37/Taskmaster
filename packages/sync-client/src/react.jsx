import { createContext, useContext, useEffect, useState } from 'react';
import { createSyncLifecycle, getSyncStatus, subscribeSyncStatus } from './lifecycle.js';

const SyncContext = createContext({ status: 'idle', lifecycle: null });

export function SyncProvider({ children, connect }) {
  const [status, setStatus] = useState(getSyncStatus());
  const [lifecycle] = useState(() => createSyncLifecycle({ connect }));

  useEffect(() => {
    return subscribeSyncStatus(setStatus);
  }, []);

  useEffect(() => () => lifecycle.dispose(), [lifecycle]);

  return (
    <SyncContext.Provider value={{ status, lifecycle }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncStatus() {
  return useContext(SyncContext).status;
}
