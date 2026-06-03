/** Sidebar / bottom-nav badge counts */
export function invalidateStatusCounts(queryClient) {
  queryClient.invalidateQueries({ queryKey: ['statusCounts'] });
}

/** Central invalidation for task-domain React Query caches. */
export function invalidateTaskDomain(queryClient) {
  queryClient.invalidateQueries({ queryKey: ['tasks'] });
  queryClient.invalidateQueries({ queryKey: ['schedule'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
  invalidateStatusCounts(queryClient);
  queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      query.queryKey[0] === 'projects' &&
      query.queryKey[2] === 'workload',
  });
  queryClient.invalidateQueries({ queryKey: ['projects', 'analytics-summary'] });
  queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      query.queryKey[0] === 'projects' &&
      query.queryKey[2] === 'analytics',
  });
}

export function invalidateReviewTasks(queryClient) {
  queryClient.invalidateQueries({ queryKey: ['tasks', 'review'] });
  queryClient.invalidateQueries({ queryKey: ['schedule'] });
  invalidateStatusCounts(queryClient);
}

/** Refetch dashboard + inbox data after auth cookie is confirmed (e.g. iOS PWA re-login). */
export function refetchUserScopedQueries(queryClient) {
  invalidateTaskDomain(queryClient);
  invalidateReviewTasks(queryClient);
  const keys = [
    ['dashboardPreset'],
    ['gamification'],
    ['announcements'],
    ['pinboard'],
    ['notes'],
    ['notifications'],
    ['statusCounts'],
    ['projects'],
    ['workspaces'],
    ['attendance'],
    ['leaveRequests'],
    ['my-reimbursements'],
  ];
  keys.forEach((queryKey) => {
    queryClient.invalidateQueries({ queryKey });
  });
}
