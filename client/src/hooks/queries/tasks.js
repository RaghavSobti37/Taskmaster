import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import axios from 'axios';
import { makePendingTask } from '../../utils/pendingTask';
import {
  getTaskQuerySnapshots,
  updateAllTaskQueries,
  restoreTaskQuerySnapshots,
  syncUpdatedTaskToQueries,
} from '../../utils/taskCache';
import { resolveTaskId } from '../../utils/taskCompletion';
import { globalToast } from '../../lib/systemLogBridge';
import { canReviewTask } from '../../utils/taskReview';
import { normalizeTasks } from '../../utils/normalizeTask';
import { invalidateTaskDomain } from '../../lib/queryInvalidation';
import { useAuth } from '../../contexts/AuthContext';

const fetchTasks = async () => {
  const { data } = await axios.get('/api/tasks');
  return data;
};

const fetchDashboardTasks = async () => {
  const { data } = await axios.get('/api/tasks', { params: { scope: 'dashboard' } });
  return data;
};

const fetchReviewTasks = async () => {
  const { data } = await axios.get('/api/tasks', { params: { scope: 'review' } });
  return data;
};

export const filterTasksForUser = (tasks, userId) => {
  if (!userId) return tasks;
  const uid = String(userId?._id || userId);
  const resolveAssigneeId = (a) => {
    if (typeof a === 'string') return a;
    if (a?._id) return String(a._id);
    if (a?.userId?._id) return String(a.userId._id);
    if (a?.userId) return String(a.userId);
    return null;
  };
  return normalizeTasks(tasks).filter((t) => {
    if (t.assigneeIds?.includes(uid)) return true;
    return t.assignees?.some((a) => resolveAssigneeId(a) === uid);
  });
};

export const useTasks = (userId) => {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: fetchTasks,
    placeholderData: keepPreviousData,
    select: (tasks) => filterTasksForUser(tasks, userId),
  });
};

export const useDashboardTasks = (userId) => {
  return useQuery({
    queryKey: ['tasks', 'dashboard'],
    queryFn: fetchDashboardTasks,
    placeholderData: keepPreviousData,
    select: (tasks) => filterTasksForUser(tasks, userId),
  });
};

export const useReviewTasks = (enabled = true) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['tasks', 'review'],
    queryFn: fetchReviewTasks,
    enabled: typeof enabled === 'boolean' ? enabled : enabled?.enabled !== false,
    staleTime: 0,
    refetchOnMount: 'always',
    placeholderData: keepPreviousData,
    select: (tasks) => normalizeTasks(tasks || []).filter((t) => canReviewTask(t, user)),
  });
};

export const useProjectTasks = (projectId) => {
  return useQuery({
    queryKey: ['tasks', { projectId }],
    queryFn: async () => (await axios.get(`/api/tasks?projectId=${projectId}`)).data,
    select: (data) => normalizeTasks(data),
    enabled: !!projectId,
    staleTime: 1000 * 60 * 2,
    placeholderData: keepPreviousData,
  });
};

export const useCreateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newTask) => {
      const { data } = await axios.post('/api/tasks', newTask);
      return data;
    },
    onMutate: async (newTask) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const snapshots = getTaskQuerySnapshots(queryClient);
      const tempId = `pending-task-${Date.now()}`;
      const optimistic = makePendingTask(newTask, tempId);
      updateAllTaskQueries(queryClient, (tasks) => [optimistic, ...(tasks || [])]);
      return { snapshots, tempId };
    },
    onSuccess: (createdTask, _variables, context) => {
      if (!context?.tempId) return;
      updateAllTaskQueries(queryClient, (tasks) =>
        (tasks || []).map((t) => (t._id === context.tempId ? { ...createdTask, _pending: false } : t))
      );
    },
    onError: (err, _variables, context) => {
      restoreTaskQuerySnapshots(queryClient, context?.snapshots);
      globalToast.addToast({
        title: 'Create failed',
        message: err.response?.data?.error || err.response?.data?.message || 'Could not create task',
        type: 'error',
        module: 'PROJECTS',
      });
    },
    onSettled: (_data, error) => {
      if (!error) {
        invalidateTaskDomain(queryClient);
        queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
      }
    },
  });
};

export const useDeleteTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.delete(`/api/tasks/${id}`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previousTasks = queryClient.getQueryData(['tasks']);
      if (previousTasks) {
        queryClient.setQueryData(['tasks'], (old) => (old || []).filter((t) => t._id !== id));
      }
      return { previousTasks };
    },
    onError: (err, id, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks'], context.previousTasks);
      }
    },
    onSettled: () => {
      invalidateTaskDomain(queryClient);
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};

export const useUpdateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await axios.put(`/api/tasks/${id}`, data);
      return res.data;
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const snapshots = getTaskQuerySnapshots(queryClient);
      updateAllTaskQueries(queryClient, (tasks) =>
        (tasks || []).map((t) =>
          resolveTaskId(t) === String(id) ? { ...t, ...data, _updating: true } : t
        )
      );
      return { snapshots };
    },
    onSuccess: (updatedTask) => {
      if (!updatedTask?._id) return;
      syncUpdatedTaskToQueries(queryClient, updatedTask);
    },
    onError: (err, _variables, context) => {
      restoreTaskQuerySnapshots(queryClient, context?.snapshots);
      globalToast.addToast({
        title: 'Update failed',
        message: err.response?.data?.error || err.response?.data?.message || 'Could not update task',
        type: 'error',
        module: 'PROJECTS',
      });
    },
    onSettled: (_data, error) => {
      if (!error) {
        invalidateTaskDomain(queryClient);
        queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
      }
    },
  });
};
