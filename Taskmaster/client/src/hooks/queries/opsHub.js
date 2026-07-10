import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import axios from 'axios';
import useTenantQueryKey from '../useTenantQueryKey';

export const useOpsHubTaxonomy = (options = {}) => {
  const queryKey = useTenantQueryKey('opsHub', 'taxonomy');
  return useQuery({
    queryKey,
    queryFn: async () => (await axios.get('/api/ops-hub/taxonomy')).data,
    staleTime: 1000 * 60 * 30,
    ...options,
  });
};

export const useOpsHubEntities = (params = {}, options = {}) => {
  const queryKey = useTenantQueryKey('opsHub', 'entities', params);
  return useQuery({
    queryKey,
    queryFn: async () => (await axios.get('/api/ops-hub/entities', { params })).data,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 30,
    ...options,
  });
};

export const useOpsHubEntity = (id, options = {}) => {
  const queryKey = useTenantQueryKey('opsHub', 'entity', id);
  return useQuery({
    queryKey,
    queryFn: async () => (await axios.get(`/api/ops-hub/entities/${id}`)).data,
    enabled: !!id,
    ...options,
  });
};

export const useOpsHubWeekly = (weekKey, options = {}) => {
  const queryKey = useTenantQueryKey('opsHub', 'weekly', weekKey);
  return useQuery({
    queryKey,
    queryFn: async () => (await axios.get('/api/ops-hub/weekly', { params: weekKey ? { weekKey } : {} })).data,
    staleTime: 1000 * 60,
    ...options,
  });
};

export const useOpsHubAnalytics = (weekKey, enabled = true, options = {}) => {
  const queryKey = useTenantQueryKey('opsHub', 'analytics', weekKey);
  return useQuery({
    queryKey,
    queryFn: async () => (await axios.get('/api/ops-hub/analytics', { params: weekKey ? { weekKey } : {} })).data,
    enabled: !!enabled,
    staleTime: 1000 * 60,
    ...options,
  });
};

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
