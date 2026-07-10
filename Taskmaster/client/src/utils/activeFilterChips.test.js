import { describe, it, expect } from 'vitest';
import {
  buildTodoActiveFilterChips,
  buildProjectsActiveFilterChips,
  buildLeadsActiveFilterChips,
  resolveSidebarDefaultOpen,
} from './activeFilterChips';

describe('buildTodoActiveFilterChips', () => {
  it('returns empty when no filters active', () => {
    expect(buildTodoActiveFilterChips()).toEqual([]);
  });

  it('includes stat filter chip', () => {
    const chips = buildTodoActiveFilterChips({ statFilter: 'overdue' });
    expect(chips).toEqual([{ id: 'statFilter', label: 'Overdue' }]);
  });

  it('includes search and dropdown filters', () => {
    const chips = buildTodoActiveFilterChips(
      {
        search: '  foo ',
        statusFilter: 'open',
        workspaceFilter: 'Default',
      },
      {
        workspaceOptions: [{ value: 'Default', label: 'Default workspace' }],
      }
    );
    expect(chips.map((c) => c.id)).toEqual(['search', 'statusFilter', 'workspaceFilter']);
    expect(chips[0].label).toBe('Search: foo');
    expect(chips[2].label).toBe('Workspace: Default workspace');
  });
});

describe('buildProjectsActiveFilterChips', () => {
  it('includes view mode when not workspace default', () => {
    const chips = buildProjectsActiveFilterChips({ viewMode: 'table' });
    expect(chips).toEqual([{ id: 'viewMode', label: 'Table view' }]);
  });

  it('includes starred and sort when non-default', () => {
    const chips = buildProjectsActiveFilterChips({
      filterStarred: true,
      sortBy: 'name',
    });
    expect(chips.map((c) => c.id)).toEqual(['filterStarred', 'sortBy']);
  });
});

describe('buildLeadsActiveFilterChips', () => {
  it('returns empty when no filters active', () => {
    expect(buildLeadsActiveFilterChips()).toEqual([]);
  });

  it('includes search, stat, and field filters', () => {
    const chips = buildLeadsActiveFilterChips(
      {
        searchTerm: 'rahul',
        statFilter: 'meaningful',
        filters: { leadStatus: 'Warm', source: 'all', assignedRepId: 'all' },
      },
      { sourceOptions: [{ value: 'Referral', label: 'Referral' }] },
    );
    expect(chips.map((c) => c.id)).toEqual(['searchTerm', 'statFilter', 'leadStatus']);
  });
});

describe('resolveSidebarDefaultOpen', () => {
  it('defaults expanded when key missing', () => {
    expect(resolveSidebarDefaultOpen(null)).toBe(true);
    expect(resolveSidebarDefaultOpen(undefined)).toBe(true);
  });

  it('respects saved preference', () => {
    expect(resolveSidebarDefaultOpen('true')).toBe(true);
    expect(resolveSidebarDefaultOpen('false')).toBe(false);
  });
});
