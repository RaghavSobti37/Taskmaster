/** React Query cache helpers for all `['tasks', …]` query keys. */

import { resolveTaskId } from './taskCompletion';

export const getTaskQuerySnapshots = (queryClient) =>
  queryClient.getQueriesData({ queryKey: ['tasks'] });

/** Keep project-scoped lists correct when a task moves between projects. */
export const syncUpdatedTaskToQueries = (queryClient, updatedTask) => {
  const taskId = resolveTaskId(updatedTask);
  if (!taskId) return;

  const newProjectId = String(updatedTask.projectId?._id || updatedTask.projectId || '');

  getTaskQuerySnapshots(queryClient).forEach(([key, value]) => {
    if (!Array.isArray(value)) return;

    const scopedProjectId = key[1]?.projectId != null ? String(key[1].projectId) : null;

    if (!scopedProjectId) {
      queryClient.setQueryData(
        key,
        value.map((t) => (resolveTaskId(t) === taskId ? { ...updatedTask, _updating: false } : t))
      );
      return;
    }

    if (scopedProjectId === newProjectId) {
      const exists = value.some((t) => resolveTaskId(t) === taskId);
      queryClient.setQueryData(
        key,
        exists
          ? value.map((t) => (resolveTaskId(t) === taskId ? { ...updatedTask, _updating: false } : t))
          : [...value, { ...updatedTask, _updating: false }]
      );
      return;
    }

    if (value.some((t) => resolveTaskId(t) === taskId)) {
      queryClient.setQueryData(
        key,
        value.filter((t) => resolveTaskId(t) !== taskId)
      );
    }
  });
};

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
