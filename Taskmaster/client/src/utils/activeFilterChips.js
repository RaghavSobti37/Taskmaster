/** Build { id, label } chips for ActiveFilterBar from page filter state. */

const TODO_STAT_LABELS = {
  open: 'Open tasks',
  overdue: 'Overdue',
  today: 'Due today',
  'in-review': 'In review',
};

const PROJECTS_VIEW_LABELS = {
  workspace: 'Grid view',
  all: 'All list',
  table: 'Table view',
};

const PROJECTS_SORT_LABELS = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  updated: 'Recently updated',
  'progress-high': 'Highest progress',
  'progress-low': 'Lowest progress',
  name: 'Alphabetical',
};

const PROJECTS_STATUS_LABELS = {
  active: 'Active only',
  completed: 'Completed',
  archived: 'Archived',
};

export function buildTodoActiveFilterChips({
  search = '',
  statusFilter = 'all',
  priorityFilter = 'all',
  typeFilter = 'all',
  workspaceFilter = 'all',
  projectFilter = 'all',
  statFilter = null,
} = {}, { typeOptions = [], workspaceOptions = [], projectOptions = [] } = {}) {
  const chips = [];
  const trimmed = search?.trim();
  if (trimmed) chips.push({ id: 'search', label: `Search: ${trimmed}` });

  if (statFilter) {
    chips.push({
      id: 'statFilter',
      label: TODO_STAT_LABELS[statFilter] || statFilter,
    });
  }
  if (statusFilter !== 'all') {
    chips.push({ id: 'statusFilter', label: `Status: ${statusFilter}` });
  }
  if (priorityFilter !== 'all') {
    chips.push({ id: 'priorityFilter', label: `Priority: ${priorityFilter}` });
  }
  if (typeFilter !== 'all') {
    const label = typeOptions.find((o) => o.value === typeFilter)?.label || typeFilter;
    chips.push({ id: 'typeFilter', label: `Category: ${label}` });
  }
  if (workspaceFilter !== 'all') {
    const label = workspaceOptions.find((o) => o.value === workspaceFilter)?.label || workspaceFilter;
    chips.push({ id: 'workspaceFilter', label: `Workspace: ${label}` });
  }
  if (projectFilter !== 'all') {
    const label = projectOptions.find((o) => o.value === projectFilter)?.label || projectFilter;
    chips.push({ id: 'projectFilter', label: `Project: ${label}` });
  }
  return chips;
}

export function buildProjectsActiveFilterChips({
  searchTerm = '',
  viewMode = 'workspace',
  filterWorkspace = 'all',
  filterStatus = 'all',
  filterStarred = false,
  sortBy = 'newest',
} = {}, { workspaceOptions = [] } = {}) {
  const chips = [];
  const trimmed = searchTerm?.trim();
  if (trimmed) chips.push({ id: 'searchTerm', label: `Search: ${trimmed}` });

  if (viewMode !== 'workspace') {
    chips.push({
      id: 'viewMode',
      label: PROJECTS_VIEW_LABELS[viewMode] || viewMode,
    });
  }
  if (filterWorkspace !== 'all') {
    const label = workspaceOptions.find((o) => o.value === filterWorkspace)?.label || filterWorkspace;
    chips.push({ id: 'filterWorkspace', label: `Workspace: ${label}` });
  }
  if (filterStatus !== 'all') {
    chips.push({
      id: 'filterStatus',
      label: `Status: ${PROJECTS_STATUS_LABELS[filterStatus] || filterStatus}`,
    });
  }
  if (filterStarred) {
    chips.push({ id: 'filterStarred', label: 'Starred only' });
  }
  if (sortBy !== 'newest') {
    chips.push({
      id: 'sortBy',
      label: `Sort: ${PROJECTS_SORT_LABELS[sortBy] || sortBy}`,
    });
  }
  return chips;
}

const LEADS_STAT_LABELS = {
  meaningful: 'Meaningful connect',
  converted: 'Converted',
};

export function buildLeadsActiveFilterChips({
  searchTerm = '',
  statFilter = null,
  filters = {},
} = {}, {
  sourceOptions = [],
  filterTeam = [],
  artistMode = false,
} = {}) {
  const chips = [];
  const trimmed = searchTerm?.trim();
  if (trimmed) chips.push({ id: 'searchTerm', label: `Search: ${trimmed}` });

  if (statFilter) {
    chips.push({
      id: 'statFilter',
      label: LEADS_STAT_LABELS[statFilter] || statFilter,
    });
  }
  if (filters.leadStatus && filters.leadStatus !== 'all') {
    chips.push({ id: 'leadStatus', label: `Interest: ${filters.leadStatus}` });
  }
  if (filters.meaningfulConnect && filters.meaningfulConnect !== 'all') {
    chips.push({ id: 'meaningfulConnect', label: `Meaningful: ${filters.meaningfulConnect}` });
  }
  if (filters.source && filters.source !== 'all') {
    const label = sourceOptions.find((o) => o.value === filters.source)?.label || filters.source;
    chips.push({ id: 'source', label: `Source: ${label}` });
  }
  if (filters.leadQuality && filters.leadQuality !== 'all') {
    chips.push({ id: 'leadQuality', label: `Quality: Level ${filters.leadQuality}` });
  }
  if (filters.assignedRepId && filters.assignedRepId !== 'all') {
    const label = filters.assignedRepId === 'unassigned'
      ? 'Unassigned'
      : filterTeam.find((r) => String(r._id) === String(filters.assignedRepId))?.name || filters.assignedRepId;
    chips.push({ id: 'assignedRepId', label: `${artistMode ? 'Manager' : 'Agent'}: ${label}` });
  }
  if (filters.artistProject && filters.artistProject !== 'all') {
    chips.push({ id: 'artistProject', label: `Artist: ${filters.artistProject}` });
  }
  if (filters.contactCategory && filters.contactCategory !== 'all') {
    chips.push({ id: 'contactCategory', label: `Category: ${filters.contactCategory.replace(/_/g, ' ')}` });
  }
  if (filters.emailStatus && filters.emailStatus !== 'all') {
    chips.push({ id: 'emailStatus', label: `Email: ${filters.emailStatus}` });
  }
  if (filters.warmPipeline) {
    chips.push({ id: 'warmPipeline', label: 'Warm pipeline' });
  }
  return chips;
}

/** First desktop visit: expanded when localStorage key absent. */
export function resolveSidebarDefaultOpen(saved) {
  if (saved === null || saved === undefined) return true;
  return saved === 'true';
}
