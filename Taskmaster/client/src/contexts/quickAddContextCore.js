import { createContext, useContext } from 'react';

/** Shared context instance — import this file from lazy chunks to avoid duplicate provider modules. */
export const QuickAddContext = createContext(null);

export function useQuickAdd() {
  const ctx = useContext(QuickAddContext);
  if (!ctx) {
    throw new Error('useQuickAdd must be used within QuickAddProvider');
  }
  return ctx;
}
