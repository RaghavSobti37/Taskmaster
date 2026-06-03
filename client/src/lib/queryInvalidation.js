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
