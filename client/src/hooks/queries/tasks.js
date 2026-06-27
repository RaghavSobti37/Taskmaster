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

const fetchTasks = async ({ includeOldCompleted = false } = {}) => {
  const params = includeOldCompleted ? { includeOldCompleted: '1' } : undefined;
  const { data } = await axios.get('/api/tasks', { params });
  return Array.isArray(data) ? data : data?.tasks || [];
};

const fetchDashboardTasks = async () => {
  const { data } = await axios.get('/api/tasks', { params: { scope: 'dashboard' } });
  return Array.isArray(data) ? data : data?.tasks || [];
};

const fetchReviewTasks = async () => {
  const { data } = await axios.get('/api/tasks', { params: { scope: 'review' } });
  return Array.isArray(data) ? data : data?.tasks || [];
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
  const filtered = normalizeTasks(tasks).filter((t) => {
    const creatorId = t.createdBy?._id || t.createdBy;
    if (creatorId && String(creatorId) === uid) return true;
    if (t.assigneeIds?.includes(uid)) return true;
    return t.assignees?.some((a) => resolveAssigneeId(a) === uid);
  });
  return filtered;
};

export const useTasks = (userId, { includeOldCompleted = false } = {}, enabled = true) => {
  return useQuery({
    queryKey: includeOldCompleted ? ['tasks', 'all-completed'] : ['tasks'],
    queryFn: () => fetchTasks({ includeOldCompleted }),
    placeholderData: keepPreviousData,
    select: (tasks) => filterTasksForUser(tasks, userId),
    enabled: enabled && !!userId,
  });
};

export const useTodoTasks = (params, userId, enabled = true) => {
  return useQuery({
    queryKey: ['tasks', 'todo', params],
    queryFn: async () => {
      const { data } = await axios.get('/api/tasks', { params: { scope: 'todo', ...params } });
      return data;
    },
    enabled: enabled && !!userId,
    placeholderData: keepPreviousData,
    select: (data) => ({
      ...data,
      tasks: normalizeTasks(data?.tasks || []),
    }),
  });
};

export const useDashboardTasks = (userId, enabled = true) => {
  return useQuery({
    queryKey: ['tasks', 'dashboard'],
    queryFn: fetchDashboardTasks,
    enabled: enabled && !!userId,
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

export const useProjectTasks = (projectId, {
  includeOldCompleted = false,
  completedPage = 1,
  completedLimit = 5,
} = {}) => {
  return useQuery({
    queryKey: includeOldCompleted
      ? ['tasks', { projectId, includeOldCompleted: true }]
      : ['tasks', { projectId, completedPage, completedLimit }],
    queryFn: async () => {
      const params = { projectId };
      if (includeOldCompleted) {
        params.includeOldCompleted = '1';
      } else {
        params.completedPage = completedPage;
        params.completedLimit = completedLimit;
      }
      return (await axios.get('/api/tasks', { params })).data;
    },
    select: (data) => {
      if (Array.isArray(data)) {
        return {
          tasks: normalizeTasks(data),
          completedTotal: data.filter((t) => t.status === 'done').length,
          completedPage: 1,
          completedLimit,
          completedPages: 1,
        };
      }
      return {
        tasks: normalizeTasks(data?.tasks || []),
        completedTotal: data?.completedTotal ?? (data?.tasks || []).filter((t) => t.status === 'done').length,
        completedPage: data?.completedPage ?? 1,
        completedLimit: data?.completedLimit ?? completedLimit,
        completedPages: data?.completedPages ?? 1,
      };
    },
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
      if (context?.tempId) {
        updateAllTaskQueries(queryClient, (tasks) =>
          (tasks || []).map((t) => (t._id === context.tempId ? { ...createdTask, _pending: false } : t))
        );
      } else if (createdTask?._id) {
        updateAllTaskQueries(queryClient, (tasks) => [createdTask, ...(tasks || [])]);
      }
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

export const useTask = (taskId, { enabled = true } = {}) => {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: async () => {
      const { data } = await axios.get(`/api/tasks/${taskId}`);
      return data;
    },
    enabled: enabled && !!taskId,
  });
};

export const useTaskActivity = (taskId, { enabled = true, markRead = true } = {}) => {
  return useQuery({
    queryKey: ['taskActivity', taskId],
    queryFn: async () => {
      const params = markRead ? { markRead: '1' } : undefined;
      const { data } = await axios.get(`/api/tasks/${taskId}/activity`, { params });
      return data;
    },
    enabled: enabled && !!taskId,
    staleTime: 0,
    refetchOnMount: 'always',
  });
};

const usePostTaskMessage = (taskId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      const { data } = await axios.post(`/api/tasks/${taskId}/activity`, { body });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskActivity', taskId] });
      invalidateTaskDomain(queryClient);
    },
    onError: (err) => {
      globalToast.addToast({
        title: 'Message failed',
        message: err.response?.data?.error || 'Could not send message',
        type: 'error',
        module: 'PROJECTS',
      });
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
    onSettled: (_data, error, variables) => {
      if (!error) {
        invalidateTaskDomain(queryClient);
        queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
        const taskId = variables?.id;
        if (taskId) queryClient.invalidateQueries({ queryKey: ['taskActivity', taskId] });
      }
    },
  });
};
