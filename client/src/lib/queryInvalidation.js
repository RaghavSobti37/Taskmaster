/** Central invalidation for task-domain React Query caches. */
export function invalidateTaskDomain(queryClient) {
  queryClient.invalidateQueries({ queryKey: ['tasks'] });
  queryClient.invalidateQueries({ queryKey: ['schedule'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
  queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      query.queryKey[0] === 'projects' &&
      query.queryKey[2] === 'workload',
  });
}

export function invalidateReviewTasks(queryClient) {
  queryClient.invalidateQueries({ queryKey: ['tasks', 'review'] });
  queryClient.invalidateQueries({ queryKey: ['schedule'] });
}
