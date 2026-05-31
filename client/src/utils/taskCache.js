/** React Query cache helpers for all `['tasks', …]` query keys. */

export const getTaskQuerySnapshots = (queryClient) =>
  queryClient.getQueriesData({ queryKey: ['tasks'] });

export const updateAllTaskQueries = (queryClient, updater) => {
  if (!queryClient || !updater) return;

  const predicates = [
    q => q.queryKey[0] === 'tasks',
    q => q.queryKey[0] === 'project-tasks',
    q => q.queryKey[0] === 'dashboard-tasks',
    q => q.queryKey[0] === 'recent-tasks'
  ];

  predicates.forEach(predicate => {
    const queries = queryClient.getQueriesData({ predicate });

    queries.forEach(([queryKey, oldData]) => {
      if (!oldData) return;

      if (oldData.tasks && Array.isArray(oldData.tasks)) {
        queryClient.setQueryData(queryKey, {
          ...oldData,
          tasks: updater(oldData.tasks)
        });
      } else if (Array.isArray(oldData)) {
        queryClient.setQueryData(queryKey, updater(oldData));
      }
    });
  });

  // Globally request a refresh of task queries to ensure sync
  window.dispatchEvent(new CustomEvent('coreknot:refresh-tasks'));
};

export const restoreTaskQuerySnapshots = (queryClient, snapshots) => {
  snapshots?.forEach(([key, value]) => {
    queryClient.setQueryData(key, value);
  });
};
