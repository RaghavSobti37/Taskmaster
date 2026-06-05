/** React Query cache helpers for all `['tasks', …]` query keys. */

import { resolveTaskId } from './taskCompletion';

export const getTaskQuerySnapshots = (queryClient) =>
  queryClient.getQueriesData({ queryKey: ['tasks'] });

const normalizeTaskListValue = (value, mapper) => {
  if (Array.isArray(value)) return mapper(value);
  if (value?.tasks && Array.isArray(value.tasks)) {
    return { ...value, tasks: mapper(value.tasks) };
  }
  return value;
};

/** Keep project-scoped lists correct when a task moves between projects. */
export const syncUpdatedTaskToQueries = (queryClient, updatedTask) => {
  const taskId = resolveTaskId(updatedTask);
  if (!taskId) return;

  const newProjectId = String(updatedTask.projectId?._id || updatedTask.projectId || '');

  getTaskQuerySnapshots(queryClient).forEach(([key, value]) => {
    const list = Array.isArray(value) ? value : value?.tasks;
    if (!Array.isArray(list)) return;

    const scopedProjectId = key[1]?.projectId != null ? String(key[1].projectId) : null;

    if (!scopedProjectId) {
      queryClient.setQueryData(
        key,
        normalizeTaskListValue(value, (tasks) =>
          tasks.map((t) => (resolveTaskId(t) === taskId ? { ...updatedTask, _updating: false } : t))
        )
      );
      return;
    }

    if (scopedProjectId === newProjectId) {
      const exists = list.some((t) => resolveTaskId(t) === taskId);
      queryClient.setQueryData(
        key,
        normalizeTaskListValue(value, (tasks) =>
          exists
            ? tasks.map((t) => (resolveTaskId(t) === taskId ? { ...updatedTask, _updating: false } : t))
            : [...tasks, { ...updatedTask, _updating: false }]
        )
      );
      return;
    }

    if (list.some((t) => resolveTaskId(t) === taskId)) {
      queryClient.setQueryData(
        key,
        normalizeTaskListValue(value, (tasks) => tasks.filter((t) => resolveTaskId(t) !== taskId))
      );
    }
  });
};

export const updateAllTaskQueries = (queryClient, updater) => {
  getTaskQuerySnapshots(queryClient).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      queryClient.setQueryData(key, updater(value));
    } else if (value?.tasks && Array.isArray(value.tasks)) {
      queryClient.setQueryData(key, { ...value, tasks: updater(value.tasks) });
    }
  });
};

export const restoreTaskQuerySnapshots = (queryClient, snapshots) => {
  snapshots?.forEach(([key, value]) => {
    queryClient.setQueryData(key, value);
  });
};
