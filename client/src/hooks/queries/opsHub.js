import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import axios from 'axios';

export const useOpsHubTaxonomy = (options = {}) => useQuery({
  queryKey: ['opsHub', 'taxonomy'],
  queryFn: async () => (await axios.get('/api/ops-hub/taxonomy')).data,
  staleTime: 1000 * 60 * 30,
  ...options,
});

export const useOpsHubEntities = (params = {}, options = {}) => useQuery({
  queryKey: ['opsHub', 'entities', params],
  queryFn: async () => (await axios.get('/api/ops-hub/entities', { params })).data,
  placeholderData: keepPreviousData,
  staleTime: 1000 * 30,
  ...options,
});

export const useOpsHubEntity = (id, options = {}) => useQuery({
  queryKey: ['opsHub', 'entity', id],
  queryFn: async () => (await axios.get(`/api/ops-hub/entities/${id}`)).data,
  enabled: !!id,
  ...options,
});

export const useOpsHubWeekly = (weekKey, options = {}) => useQuery({
  queryKey: ['opsHub', 'weekly', weekKey],
  queryFn: async () => (await axios.get('/api/ops-hub/weekly', { params: weekKey ? { weekKey } : {} })).data,
  staleTime: 1000 * 60,
  ...options,
});

export const useOpsHubAnalytics = (weekKey, enabled = true, options = {}) => useQuery({
  queryKey: ['opsHub', 'analytics', weekKey],
  queryFn: async () => (await axios.get('/api/ops-hub/analytics', { params: weekKey ? { weekKey } : {} })).data,
  enabled: !!enabled,
  staleTime: 1000 * 60,
  ...options,
});

export const useCreateOpsEntity = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => axios.post('/api/ops-hub/entities', body).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opsHub'] });
    },
  });
};

export const useUpdateOpsEntity = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => axios.patch(`/api/ops-hub/entities/${id}`, body).then((r) => r.data),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['opsHub'] });
      queryClient.invalidateQueries({ queryKey: ['opsHub', 'entity', vars.id] });
    },
  });
};

export const useSubmitOpsWeekly = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => axios.post('/api/ops-hub/weekly/submit', body).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opsHub', 'weekly'] });
      queryClient.invalidateQueries({ queryKey: ['opsHub', 'analytics'] });
    },
  });
};
