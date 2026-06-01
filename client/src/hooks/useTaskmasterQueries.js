import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import axios from 'axios';
import { subscribeToChannel } from '../lib/realtime';
import { normalizeProject, normalizeProjects } from '../utils/projectUtils';
import { makePendingTask } from '../utils/pendingTask';
import { getTaskQuerySnapshots, updateAllTaskQueries, restoreTaskQuerySnapshots } from '../utils/taskCache';
import { globalToast } from '../lib/systemLogBridge';
import { canReviewTask } from '../utils/taskReview';
import { useAuth } from '../contexts/AuthContext';

// API Fetchers
const fetchLogs = async (userId, limit = 200) => {
  const { data } = await axios.get(`/api/logs?userId=${userId}&limit=${limit}`);
  return data;
};

const fetchProjects = async () => {
  const { data } = await axios.get('/api/projects');
  return normalizeProjects(data);
};

const fetchWorkspaces = async () => {
  const { data } = await axios.get('/api/projects/workspaces');
  return data;
};

const fetchProjectById = async (id) => {
  const { data } = await axios.get(`/api/projects/${id}`);
  return normalizeProject(data);
};

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

const filterTasksForUser = (tasks, userId) => {
  if (!userId) return tasks;
  const uid = String(userId?._id || userId);
  const resolveAssigneeId = (a) => {
    if (typeof a === 'string') return a;
    if (a?._id) return String(a._id);
    if (a?.userId?._id) return String(a.userId._id);
    if (a?.userId) return String(a.userId);
    return null;
  };
  return tasks.filter((t) => t.assignees?.some((a) => resolveAssigneeId(a) === uid));
};

const fetchUserDirectory = async () => {
  const { data } = await axios.get('/api/users/directory?limit=1000');
  return data.users;
};

// Hooks with Socket.io realtime sync
export const useLogs = (userId, limit = 200, enabled = true) => {
  const queryClient = useQueryClient();
  useEffect(() => {
    return subscribeToChannel('logs', 'log_update', (newLog) => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    });
  }, [queryClient]);

  return useQuery({
    queryKey: ['logs', userId, limit],
    queryFn: () => fetchLogs(userId === 'all' || !userId ? undefined : userId, limit),
    enabled: enabled,
    placeholderData: keepPreviousData,
  });
};

export const useProjects = () => {
  const queryClient = useQueryClient();
  useEffect(() => {
    return subscribeToChannel('projects', 'project_change', (payload) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
    });
  }, [queryClient]);

  return useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });
};

export const useWorkspaces = () => {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: fetchWorkspaces,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });
};

export const useProject = (id) => {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: () => fetchProjectById(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
};

export const useTasks = (userId) => {
  const queryClient = useQueryClient();
  useEffect(() => {
    return subscribeToChannel('tasks', 'task_change', (payload) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
    });
  }, [queryClient]);

  return useQuery({
    queryKey: ['tasks'],
    queryFn: fetchTasks,
    placeholderData: keepPreviousData,
    select: (tasks) => filterTasksForUser(tasks, userId),
  });
};

export const useDashboardTasks = (userId) => {
  const queryClient = useQueryClient();
  useEffect(() => {
    return subscribeToChannel('tasks', 'task_change', () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
    });
  }, [queryClient]);

  return useQuery({
    queryKey: ['tasks', 'dashboard'],
    queryFn: fetchDashboardTasks,
    placeholderData: keepPreviousData,
    select: (tasks) => filterTasksForUser(tasks, userId),
  });
};

export const useReviewTasks = (enabled = true) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  useEffect(() => {
    return subscribeToChannel('tasks', 'task_change', () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'review'] });
    });
  }, [queryClient]);

  return useQuery({
    queryKey: ['tasks', 'review'],
    queryFn: fetchReviewTasks,
    enabled: typeof enabled === 'boolean' ? enabled : enabled?.enabled !== false,
    staleTime: 0,
    refetchOnMount: 'always',
    placeholderData: keepPreviousData,
    select: (tasks) => (tasks || []).filter((t) => canReviewTask(t, user)),
  });
};

export const useUserDirectory = () => {
  return useQuery({
    queryKey: ['userDirectory'],
    queryFn: fetchUserDirectory,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  });
};

export const useSalesReps = () => {
  return useQuery({
    queryKey: ['salesReps'],
    queryFn: async () => (await axios.get('/api/users/sales-reps')).data,
    staleTime: 1000 * 60 * 10,
  });
};

export const useCalendarEvents = () => {
  return useQuery({
    queryKey: ['calendarEvents'],
    queryFn: async () => {
      const [dbRes, googleRes] = await Promise.all([
        axios.get('/api/calendar'),
        axios.get('/api/google/calendar/events').catch(() => ({ data: [] }))
      ]);
      const dbEvents = dbRes.data.map(ev => ({
        _id: ev._id,
        title: ev.title,
        description: ev.description,
        dueDate: ev.date || ev.dueDate,
        visibility: ev.visibility,
        createdBy: ev.createdBy,
        type: ev.type || 'event',
        eventType: ev.eventType || 'event',
        workspace: ev.workspace,
        status: ev.status,
        priority: ev.priority,
        projectId: ev.projectId,
      }));
      const googleEvents = googleRes.data.map(ev => ({
        _id: ev.id,
        title: ev.summary,
        description: '',
        dueDate: ev.start.dateTime || ev.start.date,
        visibility: 'private',
        type: 'google',
        source: 'google_calendar'
      }));
      const combined = [...dbEvents, ...googleEvents];
      return Array.from(new Map(combined.map(ev => [ev._id, ev])).values());
    },
    staleTime: 1000 * 60,
  });
};

export const useProjectTasks = (projectId) => {
  return useQuery({
    queryKey: ['tasks', { projectId }],
    queryFn: async () => (await axios.get(`/api/tasks?projectId=${projectId}`)).data,
    enabled: !!projectId,
    staleTime: 1000 * 60 * 2,
    placeholderData: keepPreviousData,
  });
};

// Mutations with optimistic updates + minimal refetch
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
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
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
        queryClient.setQueryData(['tasks'], (old) => (old || []).filter(t => t._id !== id));
      }
      return { previousTasks };
    },
    onError: (err, id, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks'], context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
    }
  });
};

export const useCreateCalendarEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (event) => axios.post('/api/calendar', event),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
    }
  });
};

export const useUpdateCalendarEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => axios.put(`/api/calendar/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
    }
  });
};

export const useDeleteCalendarEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.delete(`/api/calendar/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
    }
  });
};

export const useCreateLog = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newLog) => axios.post('/api/logs', newLog),
    onMutate: async (newLog) => {
      await queryClient.cancelQueries({ queryKey: ['logs'] });
      const previousLogs = queryClient.getQueryData(['logs', newLog.userId]);
      if (previousLogs) {
        queryClient.setQueryData(['logs', newLog.userId], (old) => [
          { _id: 'temp-id-' + Date.now(), createdAt: new Date().toISOString(), ...newLog },
          ...(old || [])
        ]);
      }
      return { previousLogs };
    },
    onError: (err, newLog, context) => {
      if (context?.previousLogs) {
        queryClient.setQueryData(['logs', newLog.userId], context.previousLogs);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gamification', 'leaderboard'] });
    },
  });
};

export const useUpdateLog = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => axios.put(`/api/logs/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    }
  });
};

export const useDeleteLog = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.delete(`/api/logs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    }
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => axios.put(`/api/projects/${id}`, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['projects'] });
      const previousProjects = queryClient.getQueryData(['projects']);
      const previousProject = queryClient.getQueryData(['projects', id]);
      if (previousProject) {
        queryClient.setQueryData(['projects', id], { ...previousProject, ...data });
      }
      if (previousProjects) {
        queryClient.setQueryData(['projects'], (old) => 
          (old || []).map(p => p._id === id ? { ...p, ...data } : p)
        );
      }
      return { previousProjects, previousProject };
    },
    onError: (err, variables, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(['projects'], context.previousProjects);
      }
      if (context?.previousProject) {
        queryClient.setQueryData(['projects', variables.id], context.previousProject);
      }
    },
    onSettled: (data, error, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['projects', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
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
        (tasks || []).map((t) => (resolveTaskId(t) === String(id) ? { ...t, ...data, _updating: true } : t))
      );
      return { snapshots };
    },
    onSuccess: (updatedTask) => {
      if (!updatedTask?._id) return;
      updateAllTaskQueries(queryClient, (tasks) =>
        (tasks || []).map((t) => (resolveTaskId(t) === resolveTaskId(updatedTask) ? { ...updatedTask, _updating: false } : t))
      );
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
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
        queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
      }
    },
  });
};

export const useUpdateLead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => axios.put(`/api/crm/leads/${id}`, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['leads'] });
      const previousLeads = queryClient.getQueryData(['leads']);
      if (previousLeads) {
        queryClient.setQueryData(['leads'], (old) => 
          (old || []).map(l => l._id === id ? { ...l, ...data } : l)
        );
      }
      return { previousLeads };
    },
    onError: (err, variables, context) => {
      if (context?.previousLeads) {
        queryClient.setQueryData(['leads'], context.previousLeads);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    }
  });
};

export const useCreateLead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newLead) => axios.post('/api/crm/leads', newLead),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['crm', 'stats'] });
    }
  });
};

// Admin Queries
export const useTeams = () => {
  return useQuery({
    queryKey: ['teams'],
    queryFn: async () => (await axios.get('/api/teams')).data,
    staleTime: 1000 * 60 * 10,
  });
};

export const useCRMImports = (enabled = true) => {
  return useQuery({
    queryKey: ['crm', 'imports'],
    queryFn: async () => (await axios.get('/api/crm/imports')).data,
    enabled,
    staleTime: 1000 * 60 * 5,
  });
};

export const useCRMConfig = () => {
  return useQuery({
    queryKey: ['crm', 'config'],
    queryFn: async () => (await axios.get('/api/crm/config')).data,
    staleTime: 1000 * 60 * 10,
  });
};

export const useCRMStats = (enabled = true) => {
  return useQuery({
    queryKey: ['crm', 'stats'],
    queryFn: async () => (await axios.get('/api/crm/stats')).data,
    enabled,
    staleTime: 1000 * 60 * 2,
  });
};

export const useRepSummary = (enabled = true) => {
  return useQuery({
    queryKey: ['crm', 'repSummary'],
    queryFn: async () => (await axios.get('/api/crm/rep-summary')).data,
    enabled,
    staleTime: 1000 * 60 * 5,
  });
};

export const useMailStats = (enabled = true) => {
  return useQuery({
    queryKey: ['mail', 'stats'],
    queryFn: async () => (await axios.get('/api/mail/stats')).data,
    enabled,
    staleTime: 1000 * 60 * 5,
  });
};

export const useMailCampaigns = (enabled = true) => {
  return useQuery({
    queryKey: ['mail', 'campaigns'],
    queryFn: async () => (await axios.get('/api/campaigns')).data,
    enabled,
    staleTime: 1000 * 60 * 2,
  });
};

export const useCampaignDetails = (id) => {
  return useQuery({
    queryKey: ['campaign', id],
    queryFn: async () => (await axios.get(`/api/campaigns/${id}`)).data,
    enabled: !!id,
    staleTime: 1000 * 30,
  });
};

export const useCampaignRecipients = (id, { page = 1, limit = 25, status = 'all', hideInvalid = false } = {}) => {
  return useQuery({
    queryKey: ['campaign', id, 'recipients', page, limit, status, hideInvalid],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        status,
        hideInvalid: hideInvalid ? 'true' : 'false',
      });
      const { data } = await axios.get(`/api/campaigns/${id}/recipients?${params}`);
      return data;
    },
    enabled: !!id,
    staleTime: 1000 * 15,
    placeholderData: keepPreviousData,
  });
};

export const useCumulativeAnalytics = (enabled = true) => {
  return useQuery({
    queryKey: ['analytics', 'cumulative'],
    queryFn: async () => (await axios.get('/api/analytics/cumulative')).data,
    enabled,
    staleTime: 1000 * 60,
  });
};

export const useMailProfiles = (enabled = true) => {
  return useQuery({
    queryKey: ['mail', 'profiles'],
    queryFn: async () => (await axios.get('/api/mail/profiles')).data,
    enabled,
    staleTime: 1000 * 60 * 10,
  });
};

export const useDashboardSummary = () => {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => (await axios.get('/api/dashboard/summary')).data,
    staleTime: 1000 * 60 * 2,
  });
};

export const useActivityGrid = () => {
  return useQuery({
    queryKey: ['logs', 'activityGrid'],
    queryFn: async () => (await axios.get('/api/logs/activity-grid')).data,
    staleTime: 1000 * 60 * 10,
  });
};

export const useLiveLeads = (params, enabled = true) => {
  const queryClient = useQueryClient();
  useEffect(() => {
    return subscribeToChannel('leads', 'lead_change', () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    });
  }, [queryClient]);

  return useQuery({
    queryKey: ['leads', params],
    queryFn: async () => (await axios.get('/api/crm/leads', { params })).data,
    enabled,
    staleTime: 1000 * 60,
    placeholderData: keepPreviousData,
  });
};

export const useContacts = (enabled = true) => {
  return useQuery({
    queryKey: ['contacts'],
    queryFn: async () => (await axios.get('/api/contacts')).data,
    enabled,
    staleTime: 1000 * 60 * 5,
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => axios.put(`/api/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userDirectory'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    }
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.delete(`/api/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userDirectory'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    }
  });
};

export const useCreateTeam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => axios.post('/api/teams', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    }
  });
};

export const useDeleteTeam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.delete(`/api/teams/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    }
  });
};

export const useCreateMailProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => axios.post('/api/mail/profiles', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'profiles'] });
    }
  });
};

export const useDeleteMailProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.delete(`/api/mail/profiles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'profiles'] });
    }
  });
};

export const useUpdateMailProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => axios.put(`/api/mail/profiles/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'profiles'] });
    }
  });
};

export const useCreateCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => axios.post('/api/campaigns', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['mail', 'stats'] });
    }
  });
};

export const useUploadCampaignAttachment = () => {
  return useMutation({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await axios.post('/api/campaigns/upload-attachment', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return data;
    }
  });
};

export const useSendCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.post(`/api/campaigns/${id}/dispatch`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['mail', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['campaign', id] });
    }
  });
};

export const useStopCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.post(`/api/campaigns/${id}/stop`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['mail', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['campaign', id] });
    }
  });
};

export const useResendCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => axios.post(`/api/campaigns/${id}/resend`, data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['mail', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['campaign', id] });
      queryClient.invalidateQueries({ queryKey: ['mail', 'profiles'] });
    }
  });
};

export const useResendFilteredCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => axios.post(`/api/campaigns/${id}/resend-filtered`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['mail', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'cumulative'] });
      queryClient.invalidateQueries({ queryKey: ['mail', 'profiles'] });
    }
  });
};

export const useDeleteCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.delete(`/api/campaigns/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['mail', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'cumulative'] });
    }
  });
};

export const useScanBounces = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profileId) => axios.post('/api/mail/scan-bounces', { profileId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['mail', 'stats'] });
    }
  });
};

export const useSyncUnsubscribed = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => axios.post('/api/crm/sync-unsubscribed'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    }
  });
};

export const useLocationLeads = (location, enabled = false) => {
  return useQuery({
    queryKey: ['leads', 'location', location],
    queryFn: async () => {
      const { data } = await axios.get('/api/analytics/location-leads', {
        params: { location }
      });
      return data;
    },
    enabled: enabled && !!location
  });
};

export const sanitizeValue = (value, suffix = '') => {
  if (value === undefined || value === null || value === '' || value === 'Unavailable' || Number.isNaN(value)) {
    return 'N/A';
  }
  return `${value}${suffix}`;
};

export const useArtists = () => {
  return useQuery({
    queryKey: ['artists'],
    queryFn: async () => (await axios.get('/api/artists')).data,
    staleTime: 1000 * 60 * 5,
  });
};

export const useArtist = (id, enabled = true) => {
  return useQuery({
    queryKey: ['artist', id],
    queryFn: async () => (await axios.get(`/api/artists/${id}`)).data,
    enabled: !!id && enabled,
    staleTime: 1000 * 60 * 5,
  });
};

export const useArtistPreview = (id, token, enabled = true) => {
  return useQuery({
    queryKey: ['artist-preview', id, token],
    queryFn: async () => (await axios.get(`/api/artists/${id}/preview`, { params: { token } })).data,
    enabled: !!id && !!token && enabled,
    staleTime: 1000 * 60 * 2,
  });
};

export const useArtistAnalytics = (id, platform, timeframe = '30d', accountId = null, enabled = true) => {
  return useQuery({
    queryKey: [`artist-${platform}`, id, timeframe, accountId],
    queryFn: async () => {
      const params = { timeframe };
      if (accountId) params.accountId = accountId;
      return (await axios.get(`/api/artists/${id}/analytics/${platform}`, { params })).data;
    },
    enabled: !!id && !!platform && enabled,
    staleTime: 1000 * 60 * 5,
  });
};

export const useCreateArtist = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newArtist) => axios.post('/api/artists', newArtist),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artists'] });
    }
  });
};

export const useUpdateArtist = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => axios.put(`/api/artists/${id}`, data),
    onSuccess: (res, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['artists'] });
      queryClient.invalidateQueries({ queryKey: ['artist', id] });
    }
  });
};

export const useDeleteArtist = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.delete(`/api/artists/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artists'] });
    }
  });
};

export const useSyncArtistStats = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.post(`/api/artists/${id}/sync-stats`),
    onSuccess: (res, id) => {
      queryClient.setQueryData(['artist', id], res.data);
      queryClient.invalidateQueries({ queryKey: ['artists'] });
      queryClient.invalidateQueries({ queryKey: ['artist', id] });
      queryClient.invalidateQueries({ queryKey: ['artist-spotify', id] });
      queryClient.invalidateQueries({ queryKey: ['artist-youtube', id] });
      queryClient.invalidateQueries({ queryKey: ['artist-meta', id] });
    }
  });
};

export const useAddTrackedVideo = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => axios.post(`/api/artists/${id}/tracked-video`, data),
    onSuccess: (res, { id }) => {
      queryClient.setQueryData(['artist', id], res.data);
      queryClient.invalidateQueries({ queryKey: ['artists'] });
      queryClient.invalidateQueries({ queryKey: ['artist', id] });
      queryClient.invalidateQueries({ queryKey: ['artist-youtube', id] });
      queryClient.invalidateQueries({ queryKey: ['artist-spotify', id] });
      queryClient.invalidateQueries({ queryKey: ['artist-instagram', id] });
    }
  });
};

export const useCreateShareLink = () => {
  return useMutation({
    mutationFn: (id) => axios.post(`/api/artists/${id}/share-link`).then((r) => r.data),
  });
};

export const useSetPrimaryConnection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ artistId, connectionId }) =>
      axios.put(`/api/artists/${artistId}/connections/${connectionId}/primary`).then((r) => r.data),
    onSuccess: (_data, { artistId }) => {
      queryClient.invalidateQueries({ queryKey: ['artist', artistId] });
      queryClient.invalidateQueries({ queryKey: ['artists'] });
    },
  });
};

export const useLeadAudits = (params, enabled = true) => {
  return useQuery({
    queryKey: ['leadAudits', params],
    queryFn: async () => (await axios.get('/api/crm/leads/audit-logs', { params })).data,
    enabled,
    staleTime: 1000 * 30,
  });
};

export const useMailTemplates = (enabled = true) => {
  return useQuery({
    queryKey: ['mail', 'templates'],
    queryFn: async () => (await axios.get('/api/mail/templates')).data,
    enabled,
    staleTime: 1000 * 60 * 5,
  });
};

export const useSaveMailTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => axios.post('/api/mail/templates', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'templates'] });
    }
  });
};

export const useDeleteMailTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name) => axios.delete(`/api/mail/templates/${name}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'templates'] });
    }
  });
};

export const useAttendance = (params = {}, enabled = true) => {
  return useQuery({
    queryKey: ['attendance', params],
    queryFn: async () => (await axios.get('/api/attendance', { params })).data,
    enabled,
    staleTime: 1000 * 60
  });
};

export const useAttendanceCheck = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => axios.post('/api/attendance/check', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['gamification', 'leaderboard'] });
    }
  });
};

export const useUndoAttendanceCheck = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => axios.post('/api/attendance/check/undo', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
};

export const useApproveAttendance = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approvalTarget, manualTime, workMode }) => axios.patch(`/api/attendance/${id}/approve`, { approvalTarget, manualTime, workMode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
};

export const useApplyLeave = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => axios.post('/api/attendance/leave', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] });
    }
  });
};

export const useLeaveRequests = (params = {}, enabled = true) => {
  return useQuery({
    queryKey: ['leaveRequests', params],
    queryFn: async () => (await axios.get('/api/attendance/leave/requests', { params })).data,
    enabled,
    staleTime: 1000 * 30,
  });
};

export const useApproveLeaveRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.patch(`/api/attendance/leave/requests/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
};

export const useRejectLeaveRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reviewNote }) => axios.patch(`/api/attendance/leave/requests/${id}/reject`, { reviewNote }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] });
    },
  });
};

export const useResetAttendance = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => axios.delete('/api/attendance/reset'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] });
    },
  });
};

export const useUpdateAttendance = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => axios.put(`/api/attendance/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    }
  });
};

export const useUpsertAttendance = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => axios.put('/api/attendance/upsert/by-user-date', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    }
  });
};

export const useLeaderboard = (enabled = true) => {
  return useQuery({
    queryKey: ['gamification', 'leaderboard'],
    queryFn: async () => (await axios.get('/api/gamification/leaderboard')).data,
    enabled,
    staleTime: 1000 * 60
  });
};

export const useLeaderboardBreakdown = (userId, enabled = true) => {
  return useQuery({
    queryKey: ['gamification', 'leaderboard', 'breakdown', userId],
    queryFn: async () => (await axios.get(`/api/gamification/leaderboard/${userId}/breakdown`)).data,
    enabled: enabled && !!userId,
    staleTime: 1000 * 30
  });
};

export const useAnnouncements = (enabled = true, refetchInterval = false, includeExpired = false) => {
  return useQuery({
    queryKey: ['announcements', { includeExpired }],
    queryFn: async () => (await axios.get('/api/announcements', { params: { includeExpired } })).data,
    enabled,
    staleTime: 1000 * 60,
    refetchInterval
  });
};

export const useAnnouncementTargets = (enabled = true) => {
  return useQuery({
    queryKey: ['announcementTargets'],
    queryFn: async () => (await axios.get('/api/announcements/targets')).data,
    enabled,
    staleTime: 1000 * 60 * 5
  });
};

export const useCreateAnnouncement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => axios.post('/api/announcements', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
    }
  });
};

export const useDeleteAnnouncement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.delete(`/api/announcements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
    }
  });
};

export const useDepartments = (publicOnly = false) => {
  return useQuery({
    queryKey: ['departments', { publicOnly }],
    queryFn: async () => (await axios.get(publicOnly ? '/api/departments/public' : '/api/departments')).data,
    staleTime: 1000 * 60 * 10
  });
};

export const useCreateDepartment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => axios.post('/api/departments', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
  });
};

export const useUpdateDepartment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => axios.patch(`/api/departments/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

export const useDeleteDepartment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.delete(`/api/departments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
  });
};

export const useDepartmentMonthlyReport = (departmentId, month, enabled = true) => {
  return useQuery({
    queryKey: ['departmentMonthlyReport', departmentId, month],
    queryFn: async () => (await axios.get(`/api/departments/${departmentId}/monthly-report`, { params: { month } })).data,
    enabled: enabled && !!departmentId && !!month,
  });
};

export const useTeamMonthlyReport = (month, enabled = true) => {
  return useQuery({
    queryKey: ['teamMonthlyReport', month],
    queryFn: async () => (await axios.get('/api/departments/team/monthly-report', { params: { month } })).data,
    enabled: enabled && !!month,
  });
};

/** @deprecated Prefer TASK_CATEGORY_OPTIONS — returns general task categories. */
export const useTaskTypes = () => {
  const categories = [
    { name: 'bug', label: 'Bug' },
    { name: 'feature', label: 'Feature' },
    { name: 'content', label: 'Content' },
    { name: 'design', label: 'Design' },
    { name: 'ops', label: 'Operations' },
    { name: 'review', label: 'Review' },
    { name: 'general', label: 'General' },
  ];
  return useQuery({
    queryKey: ['taskCategories'],
    queryFn: async () => categories,
    staleTime: Infinity,
    initialData: categories,
  });
};

export const useSchedule = ({ start, end, projectId, departmentId } = {}, enabled = true) => {
  return useQuery({
    queryKey: ['schedule', start, end, projectId, departmentId],
    queryFn: async () => (await axios.get('/api/schedule', {
      params: { start, end, projectId, departmentId }
    })).data,
    enabled: enabled && !!start && !!end,
    staleTime: 1000 * 30
  });
};

export const useProjectWorkload = (projectId, start, end, enabled = true) => {
  return useQuery({
    queryKey: ['projects', projectId, 'workload', start, end],
    queryFn: async () => (await axios.get(`/api/projects/${projectId}/workload`, { params: { start, end } })).data,
    enabled: enabled && !!projectId,
    staleTime: 1000 * 30
  });
};

export const useProjectHoursSummary = (projectId, enabled = true) => {
  return useQuery({
    queryKey: ['projects', projectId, 'hours-summary'],
    queryFn: async () => (await axios.get(`/api/projects/${projectId}/hours-summary`)).data,
    enabled: enabled && !!projectId,
    staleTime: 1000 * 60
  });
};

export const useNotifications = (enabled = true) => {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await axios.get('/api/notifications')).data,
    enabled,
    staleTime: 1000 * 15,
    refetchInterval: 1000 * 30
  });
};

export const useStatusCounts = (enabled = true) => {
  return useQuery({
    queryKey: ['statusCounts'],
    queryFn: async () => (await axios.get('/api/notifications/status-counts')).data,
    enabled,
    staleTime: 1000 * 15,
    refetchInterval: 1000 * 30
  });
};

export const useUserNotes = (enabled = true) => {
  return useQuery({
    queryKey: ['notes'],
    queryFn: async () => (await axios.get('/api/notes')).data,
    enabled,
    staleTime: 1000 * 30
  });
};

export const useCreateNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => axios.post('/api/notes', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes'] })
  });
};

export const useUpdateNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => axios.put(`/api/notes/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes'] })
  });
};

export const useDeleteNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.delete(`/api/notes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes'] })
  });
};

export const usePinBoard = (enabled = true) => {
  return useQuery({
    queryKey: ['pinboard'],
    queryFn: async () => (await axios.get('/api/pinboard')).data,
    enabled,
    staleTime: 1000 * 30
  });
};

export const useCreatePin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => axios.post('/api/pinboard', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pinboard'] })
  });
};

export const useUpdatePin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => axios.put(`/api/pinboard/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pinboard'] })
  });
};

export const useDeletePin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.delete(`/api/pinboard/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pinboard'] })
  });
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.patch(`/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['statusCounts'] });
    }
  });
};

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => axios.patch('/api/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['statusCounts'] });
    }
  });
};

export const useUpdateUserDepartment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, departmentId }) => axios.patch(`/api/departments/users/${userId}`, { departmentId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] })
  });
};

export const useDashboardPreset = () => {
  return useQuery({
    queryKey: ['dashboardPreset'],
    queryFn: async () => {
      const { data } = await axios.get('/api/customization/dashboard/preset');
      return data;
    },
    staleTime: 5 * 60 * 1000
  });
};

export const useNavbarPreferences = () => {
  return useQuery({
    queryKey: ['navbarPreferences'],
    queryFn: async () => {
      const { data } = await axios.get('/api/customization/navbar');
      return data;
    },
    staleTime: 5 * 60 * 1000
  });
};
