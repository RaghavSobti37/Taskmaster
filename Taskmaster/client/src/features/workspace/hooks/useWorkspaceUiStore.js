import { create } from 'zustand';

/** Layout-only UI state — decoupled from server/sync cache. */
export const useWorkspaceUiStore = create((set) => ({
  sidebarCollapsed: false,
  projectFilters: {},
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  setProjectFilter: (projectId, filters) =>
    set((state) => ({
      projectFilters: { ...state.projectFilters, [projectId]: filters },
    })),
  clearProjectFilter: (projectId) =>
    set((state) => {
      const next = { ...state.projectFilters };
      delete next[projectId];
      return { projectFilters: next };
    }),
}));
