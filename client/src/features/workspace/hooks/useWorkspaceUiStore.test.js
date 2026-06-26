import { describe, expect, it } from 'vitest';
import { useWorkspaceUiStore } from './useWorkspaceUiStore';

describe('useWorkspaceUiStore', () => {
  it('stores layout filters separately from server state', () => {
    useWorkspaceUiStore.getState().setProjectFilter('p1', { status: 'todo' });
    expect(useWorkspaceUiStore.getState().projectFilters.p1).toEqual({ status: 'todo' });
    useWorkspaceUiStore.getState().clearProjectFilter('p1');
    expect(useWorkspaceUiStore.getState().projectFilters.p1).toBeUndefined();
  });
});
