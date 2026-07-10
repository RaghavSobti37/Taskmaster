import React, { createContext, useCallback, useContext, useId, useMemo, useState } from 'react';
import UnsavedChangesBar from '../components/UnsavedChangesBar';

const UnsavedChangesContext = createContext(null);

export function useUnsavedChangesContext() {
  return useContext(UnsavedChangesContext);
}

export function UnsavedChangesProvider({ children }) {
  const [registrations, setRegistrations] = useState(() => new Map());

  const register = useCallback((id, payload) => {
    setRegistrations((prev) => {
      const next = new Map(prev);
      next.set(id, payload);
      return next;
    });
  }, []);

  const unregister = useCallback((id) => {
    setRegistrations((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const active = useMemo(() => {
    const list = [...registrations.values()].filter((entry) => entry?.hasChanges);
    if (!list.length) return null;
    const elevated = list.filter((entry) => entry.elevated);
    return elevated.length ? elevated[elevated.length - 1] : list[list.length - 1];
  }, [registrations]);

  const value = useMemo(() => ({ register, unregister }), [register, unregister]);

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      <UnsavedChangesBar
        hasChanges={!!active?.hasChanges}
        onCancel={active?.onCancel}
        onSave={active?.onSave}
        isSaving={active?.isSaving}
        elevated={active?.elevated}
        changes={active?.changes}
      />
    </UnsavedChangesContext.Provider>
  );
}
