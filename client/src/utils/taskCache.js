/** React Query cache helpers for all `['tasks', …]` query keys. */

export const getTaskQuerySnapshots = (queryClient) =>
  queryClient.getQueriesData({ queryKey: ['tasks'] });

export const updateAllTaskQueries = (queryClient, updater) => {
  getTaskQuerySnapshots(queryClient).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      queryClient.setQueryData(key, updater(value));
    }
  });
};

export const restoreTaskQuerySnapshots = (queryClient, snapshots) => {
  snapshots?.forEach(([key, value]) => {
    queryClient.setQueryData(key, value);
  });
};
