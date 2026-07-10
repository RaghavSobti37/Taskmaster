import { createContext, useContext } from 'react';

const DashboardLayoutContext = createContext({ expandContent: false });

export const DashboardLayoutProvider = DashboardLayoutContext.Provider;

export function useDashboardLayout() {
  return useContext(DashboardLayoutContext);
}
