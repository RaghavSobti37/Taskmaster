import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createSyncLifecycle, getSyncStatus, subscribeSyncStatus } from './lifecycle.js';

const SyncContext = createContext({ status: 'idle', lifecycle: null });

export function SyncProvider({ children, connect }) {
  const [status, setStatus] = useState(() => getSyncStatus());
  const lifecycleRef = useRef(null);

  useEffect(() => {
    const lifecycle = createSyncLifecycle({ connect });
    lifecycleRef.current = lifecycle;
    return () => {
      lifecycle.dispose();
      lifecycleRef.current = null;
    };
  }, [connect]);

  useEffect(() => subscribeSyncStatus(setStatus), []);

  return (
    <SyncContext.Provider value={{ status, lifecycle: lifecycleRef.current }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncStatus() {
  return useContext(SyncContext).status;
}
