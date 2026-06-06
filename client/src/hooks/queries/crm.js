import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import axios from 'axios';
import { subscribeToChannel } from '../../lib/realtime';
import { invalidateStatusCounts } from '../../lib/queryInvalidation';
import { normalizeRepSummaryPayload } from '../../utils/adminRibbonMetrics';

export const useSalesReps = () => useQuery({
  queryKey: ['salesReps'],
  queryFn: async () => (await axios.get('/api/users/sales-reps')).data,
  staleTime: 1000 * 60 * 10,
});

export const useUpdateLead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => (await axios.put(`/api/crm/leads/${id}`, data)).data,
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['leads'] });
      const snapshots = queryClient.getQueriesData({ queryKey: ['leads'] });
      queryClient.setQueriesData({ queryKey: ['leads'] }, (old) => {
        if (!old?.leads) return old;
        return {
          ...old,
          leads: old.leads.map((l) => (String(l._id) === String(id) ? { ...l, ...data } : l)),
        };
      });
      return { snapshots };
    },
    onError: (_err, _variables, context) => {
      for (const [key, data] of context?.snapshots || []) {
        queryClient.setQueryData(key, data);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['crm', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['crm', 'repSummary'] });
      invalidateStatusCounts(queryClient);
    },
  });
};

export const useCreateLead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newLead) => axios.post('/api/crm/leads', newLead),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['crm', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['crm', 'repSummary'] });
      invalidateStatusCounts(queryClient);
    },
  });
};

const useCRMImports = (enabled = true) => useQuery({
  queryKey: ['crm', 'imports'],
  queryFn: async () => (await axios.get('/api/crm/imports')).data,
  enabled,
  staleTime: 1000 * 60 * 5,
});

export const useCRMConfig = () => useQuery({
  queryKey: ['crm', 'config'],
  queryFn: async () => (await axios.get('/api/crm/config')).data,
  staleTime: 1000 * 60 * 10,
});

export const useCRMStats = (enabled = true, options = {}) => useQuery({
  queryKey: ['crm', 'stats'],
  queryFn: async () => (await axios.get('/api/crm/stats')).data,
  enabled,
  staleTime: options.staleTime ?? 1000 * 60 * 2,
  refetchOnWindowFocus: options.refetchOnWindowFocus ?? true,
  refetchOnMount: options.refetchOnMount,
});

const useRepSummary = (enabled = true, options = {}) => useQuery({
  queryKey: ['crm', 'repSummary'],
  queryFn: async () => {
    const { data } = await axios.get('/api/crm/rep-summary');
    return normalizeRepSummaryPayload(data);
  },
  enabled,
  staleTime: options.staleTime ?? 1000 * 60 * 5,
  refetchOnWindowFocus: options.refetchOnWindowFocus ?? true,
  refetchOnMount: options.refetchOnMount,
});

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

export const useLeadAudits = (params, enabled = true) => useQuery({
  queryKey: ['leadAudits', params],
  queryFn: async () => (await axios.get('/api/crm/leads/audit-logs', { params })).data,
  enabled,
  staleTime: 1000 * 30,
});
