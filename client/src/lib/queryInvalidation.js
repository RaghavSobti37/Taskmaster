import { tenantQueryKey } from './tenantQuery';

/** Sidebar / bottom-nav badge counts */
export function invalidateStatusCounts(queryClient, tenantId) {
  queryClient.invalidateQueries({ queryKey: tenantQueryKey(tenantId, 'statusCounts') });
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
    ['notifications'], // prefix — all user-scoped notification caches
    ['statusCounts'],
    ['projects'],
    ['workspaces'],
    ['attendance'],
    ['leaveRequests'],
    ['my-reimbursements'],
    ['adminRoles'],
    ['artist-os'],
    ['system-health'],
  ];
  keys.forEach((queryKey) => {
    if (queryKey[0] === 'notifications') {
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey[0] === 'notifications',
      });
      return;
    }
    if (queryKey[0] === 'artist-os') {
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey[0] === 'artist-os',
      });
      return;
    }
    queryClient.invalidateQueries({ queryKey });
  });
}
