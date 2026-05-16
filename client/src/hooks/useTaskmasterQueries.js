import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

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
  const { data } = await axios.get('/api/users/directory');
  return data.users;
};

// Hooks
export const useLogs = (userId, limit = 200, enabled = true) => {
  return useQuery({
    queryKey: ['logs', userId, limit],
    queryFn: () => fetchLogs(userId === 'all' || !userId ? undefined : userId, limit),
    enabled: enabled,
  });
};

export const useProjects = () => {
  return useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
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
    staleTime: 1000 * 60 * 30, // 30 minutes (Static Data)
    gcTime: 1000 * 60 * 60, // 1 hour
  });
};

// Mutations
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
          ...old
        ]);
      }
      return { previousLogs };
    },
    onError: (err, newLog, context) => {
      if (context?.previousLogs) {
        queryClient.setQueryData(['logs', newLog.userId], context.previousLogs);
      }
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    },
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => axios.put(`/api/projects/${id}`, data),
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches for both list and detail
      await queryClient.cancelQueries({ queryKey: ['projects'] });
      
      // Snapshot list and detail
      const previousProjects = queryClient.getQueryData(['projects']);
      const previousProject = queryClient.getQueryData(['projects', id]);

      // Optimistically update Detail
      if (previousProject) {
        queryClient.setQueryData(['projects', id], { ...previousProject, ...data });
      }

      // Optimistically update List (Cache Normalization)
      if (previousProjects) {
        queryClient.setQueryData(['projects'], (old) => 
          old.map(p => p._id === id ? { ...p, ...data } : p)
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
      // We don't necessarily need to invalidate the whole list if we trust our local update,
      // but it's safer for eventual consistency.
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
          old.map(t => t._id === id ? { ...t, ...data } : t)
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
          old.map(l => l._id === id ? { ...l, ...data } : l)
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
    queryFn: async () => (await axios.get('/api/mail/campaigns')).data,
    enabled,
    staleTime: 1000 * 60 * 2,
  });
};

export const useMailProfiles = (enabled = true) => {
  return useQuery({
    queryKey: ['mail', 'profiles'],
    queryFn: async () => (await axios.get('/api/mail/profiles')).data,
    enabled,
    staleTime: 1000 * 60 * 10,
  });
};export const useDashboardSummary = () => {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => (await axios.get('/api/dashboard/summary')).data,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
};

export const useActivityGrid = () => {
  return useQuery({
    queryKey: ['logs', 'activityGrid'],
    queryFn: async () => (await axios.get('/api/logs/activity-grid')).data,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};

export const useLiveLeads = (params, enabled = true) => {
  return useQuery({
    queryKey: ['leads', params],
    queryFn: async () => (await axios.get('/api/crm/leads', { params })).data,
    enabled,
    staleTime: 1000 * 60, // 1 minute
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

export const useCreateTeam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => axios.post('/api/teams', data),
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

export const useCreateCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => axios.post('/api/mail/campaigns', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['mail', 'stats'] });
    }
  });
};

export const useSendCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.post(`/api/mail/campaigns/${id}/send`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail', 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['mail', 'stats'] });
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
