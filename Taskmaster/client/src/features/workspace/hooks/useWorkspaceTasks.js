import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { readLocalTasks } from '../../../lib/localFirstBootstrap';
import { upsertLocalTask, deleteLocalTask } from '../api/localTasks';
import { useProjects } from '../../../hooks/queries/projects';
import { useAuth } from '../../../contexts/AuthContext';

const LOCAL_TASKS_KEY = (projectId) => ['local-first', 'tasks', projectId];

/**
 * Local-first task reads with network fallback via existing useProjects.
 * Pilot: merges local SQLite rows when VITE_LOCAL_FIRST=true.
 */
export function useWorkspaceTasks(projectId, { enabled = true } = {}) {
  const { user } = useAuth();
  const localFirst = import.meta.env.VITE_LOCAL_FIRST === 'true';
  const queryClient = useQueryClient();

  const localQuery = useQuery({
    queryKey: LOCAL_TASKS_KEY(projectId),
    queryFn: () => readLocalTasks(projectId),
    enabled: enabled && localFirst && Boolean(projectId),
    staleTime: 30_000,
  });

  const networkProjects = useProjects(enabled && !localFirst);

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      if (!localFirst) {
        const axios = (await import('axios')).default;
        const { data } = await axios.post('/api/tasks', payload);
        return data;
      }
      return upsertLocalTask({
        tenantId: user?.tenantId,
        projectId,
        title: payload.title,
        status: payload.status || 'todo',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LOCAL_TASKS_KEY(projectId) });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (taskId) => {
      if (!localFirst) {
        const axios = (await import('axios')).default;
        await axios.delete(`/api/tasks/${taskId}`);
        return;
      }
      await deleteLocalTask(taskId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LOCAL_TASKS_KEY(projectId) });
    },
  });

  return {
    tasks: localFirst ? (localQuery.data ?? []) : null,
    isLoading: localFirst ? localQuery.isLoading : networkProjects.isLoading,
    isLocalFirst: localFirst,
    createTask: createMutation.mutateAsync,
    deleteTask: deleteMutation.mutateAsync,
    syncStatus: localQuery.data?.some?.((t) => t.syncStatus === 'pending')
      ? 'offline-queued'
      : 'synced',
  };
}

export function useWorkspacePilotEnabled() {
  return import.meta.env.VITE_LOCAL_FIRST === 'true';
}
