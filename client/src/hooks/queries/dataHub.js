import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import axios from 'axios';

export const DATA_HUB_REFRESH_MS = 3 * 60 * 60 * 1000;

const pollBackupUntilDone = async () => {
  for (;;) {
    const { data } = await axios.get('/api/data-hub/backup/progress');
    if (data.status === 'completed') {
      return { ...data.result, emailSent: true };
    }
    if (data.status === 'failed') {
      const err = new Error(data.error || data.result?.error || 'Backup failed');
      err.response = { data: { error: err.message, ...data.result } };
      throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
};

export const useDataHubFolders = (options = {}) => {
  const refetchInterval = options.refetchInterval === false
    ? false
    : (options.refetchInterval ?? DATA_HUB_REFRESH_MS);
  return useQuery({
    queryKey: ['dataHub', 'folders'],
    queryFn: async () => (await axios.get('/api/data-hub/folders')).data,
    staleTime: options.staleTime ?? DATA_HUB_REFRESH_MS,
    refetchInterval,
    refetchOnWindowFocus: options.refetchOnWindowFocus ?? false,
    refetchOnMount: options.refetchOnMount,
    enabled: options.enabled !== false,
  });
};

export const useDataHubPeople = (params, options = {}) => useQuery({
  queryKey: ['dataHub', 'people', params],
  queryFn: async () => (await axios.get('/api/data-hub/people', { params })).data,
  placeholderData: keepPreviousData,
  staleTime: DATA_HUB_REFRESH_MS,
  refetchInterval: options.refetchInterval ?? DATA_HUB_REFRESH_MS,
});

export const useDataHubPerson = (id) => useQuery({
  queryKey: ['dataHub', 'person', id, 'base'],
  queryFn: async () => (await axios.get(`/api/data-hub/people/${id}`)).data,
  enabled: !!id,
  staleTime: 1000 * 60 * 2,
});

export const useDataHubPersonSection = (id, section) => useQuery({
  queryKey: ['dataHub', 'person', id, 'section', section],
  queryFn: async () => (await axios.get(`/api/data-hub/people/${id}`, { params: { section } })).data,
  enabled: !!id && !!section,
  staleTime: 1000 * 60 * 5,
});

export const useDataHubAnalytics = (folder = 'all', options = {}) => useQuery({
  queryKey: ['dataHub', 'analytics', folder],
  queryFn: async () => (await axios.get('/api/data-hub/analytics', { params: { folder } })).data,
  enabled: options.enabled !== false,
  staleTime: DATA_HUB_REFRESH_MS,
  refetchInterval: options.refetchInterval ?? DATA_HUB_REFRESH_MS,
});

export const useDataHubSyncStatus = (options = {}) => useQuery({
  queryKey: ['dataHub', 'syncStatus'],
  queryFn: async () => (await axios.get('/api/data-hub/sync-status')).data,
  staleTime: DATA_HUB_REFRESH_MS,
  refetchInterval: DATA_HUB_REFRESH_MS,
  enabled: options.enabled !== false,
});

export const useDataHubReconcile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ full = false } = {}) => axios.post('/api/data-hub/reconcile', null, { params: full ? { full: 'true' } : {} }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dataHub'] });
      await queryClient.refetchQueries({ queryKey: ['dataHub'], type: 'active' });
    },
  });
};

export const useDataHubRebuildPersonHub = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => axios.post('/api/data-hub/rebuild-person-hub'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dataHub'] });
      await queryClient.refetchQueries({ queryKey: ['dataHub'], type: 'active' });
    },
  });
};

export const useDataHubBackups = (options = {}) => useQuery({
  queryKey: ['dataHub', 'backups'],
  queryFn: async () => (await axios.get('/api/data-hub/backups')).data,
  staleTime: 60 * 1000,
  ...options,
});

export const useDataHubBackupProgress = (enabled = false, poll = false) => useQuery({
  queryKey: ['dataHub', 'backup-progress'],
  queryFn: async () => (await axios.get('/api/data-hub/backup/progress')).data,
  refetchInterval: enabled && poll ? 500 : false,
  staleTime: 0,
  enabled,
});

export const useDataHubProductionBackup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ notify = true } = {}) => {
      await axios.post('/api/data-hub/backup', null, {
        params: notify ? {} : { notify: 'false' },
        timeout: 15000,
      });
      return pollBackupUntilDone();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataHub', 'backups'] });
      queryClient.invalidateQueries({ queryKey: ['dataHub', 'backup-progress'] });
    },
  });
};
