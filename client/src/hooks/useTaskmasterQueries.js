import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import axios from 'axios';
import { subscribeToChannel } from '../lib/supabase';

// API Fetchers
const fetchLogs = async (userId, limit = 200) => {
  const { data } = await axios.get(`/api/logs?userId=${userId}&limit=${limit}`);
  return data;
};

const fetchProjects = async () => {
  const { data } = await axios.get('/api/projects');
  return data;
};

const fetchProjectById = async (id) => {
  const { data } = await axios.get(`/api/projects/${id}`);
  return data;
};

const fetchTasks = async () => {
  const { data } = await axios.get('/api/tasks');
  return data;
};

const fetchUserDirectory = async () => {
  const { data } = await axios.get('/api/users/directory?limit=1000');
  return data.users;
};

// Hooks with Supabase Realtime Sync
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
    select: (tasks) => {
      if (!userId) return tasks;
      return tasks.filter(t =>
        t.assignees?.some(a => (typeof a === 'string' ? a : a._id) === userId)
      );
    }
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
        dueDate: ev.date,
        visibility: ev.visibility,
        createdBy: ev.createdBy,
        type: ev.type || 'event',
        status: ev.status,
        priority: ev.priority,
        projectId: ev.projectId
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
  });
};

// Mutations with Zero-Latency Optimistic Updates
export const useCreateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newTask) => axios.post('/api/tasks', newTask),
    onMutate: async (newTask) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previousTasks = queryClient.getQueryData(['tasks']);
      if (previousTasks) {
        queryClient.setQueryData(['tasks'], (old) => [
          { _id: `temp-${Date.now()}`, createdAt: new Date().toISOString(), status: 'Todo', priority: 'Medium', ...newTask },
          ...(old || [])
        ]);
      }
      return { previousTasks };
    },
    onError: (err, newTask, context) => {
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
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
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
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
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
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
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
    mutationFn: ({ id, data }) => axios.put(`/api/tasks/${id}`, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previousTasks = queryClient.getQueryData(['tasks']);
      if (previousTasks) {
        queryClient.setQueryData(['tasks'], (old) => 
          (old || []).map(t => t._id === id ? { ...t, ...data } : t)
        );
      }
      return { previousTasks };
    },
    onError: (err, variables, context) => {
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
      queryClient.invalidateQueries({ queryKey: ['analytics', 'cumulative'] });
    }
  });
};

export const useSendCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.post(`/api/campaigns/${id}/dispatch`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['mail', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'cumulative'] });
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

export const useArtist = (id) => {
  return useQuery({
    queryKey: ['artist', id],
    queryFn: async () => (await axios.get(`/api/artists/${id}`)).data,
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
};

export const useArtistAnalytics = (id, platform, timeframe = '30d') => {
  return useQuery({
    queryKey: [`artist-${platform}`, id, timeframe],
    queryFn: async () => (await axios.get(`/api/artists/${id}/analytics/${platform}?timeframe=${timeframe}`)).data,
    enabled: !!id && !!platform,
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
    }
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
