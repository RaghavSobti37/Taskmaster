import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import axios from 'axios';
import { subscribeToChannel } from '../../lib/realtime';
import { invalidateStatusCounts } from '../../lib/queryInvalidation';
import { normalizeRepSummaryPayload } from '../../utils/adminRibbonMetrics';

export const useSalesReps = (enabled = true) => useQuery({
  queryKey: ['salesReps'],
  queryFn: async () => (await axios.get('/api/users/sales-reps')).data,
  enabled,
  staleTime: 1000 * 60 * 10,
});

export const useArtistReps = (enabled = true) => useQuery({
  queryKey: ['artistReps'],
  queryFn: async () => (await axios.get('/api/users/artist-reps')).data,
  enabled,
  staleTime: 1000 * 60 * 10,
});

export const useArtistImportSheets = (enabled = true) => useQuery({
  queryKey: ['artistImportSheets'],
  queryFn: async () => (await axios.get('/api/crm/artist/import-sheets')).data?.sheets || [],
  enabled,
  staleTime: 1000 * 60 * 30,
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
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      if (variables?.id) {
        queryClient.invalidateQueries({ queryKey: ['leads', 'detail', variables.id] });
      }
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

const useCRMImports = (enabled = true, params = {}) => useQuery({
  queryKey: ['crm', 'imports', params],
  queryFn: async () => (await axios.get('/api/crm/imports', { params })).data,
  enabled,
  staleTime: 1000 * 60 * 5,
});

export const useCRMConfig = (enabled = true) => useQuery({
  queryKey: ['crm', 'config'],
  queryFn: async () => (await axios.get('/api/crm/config')).data,
  staleTime: 1000 * 60 * 10,
  enabled,
});

export const useCRMStats = (enabled = true, options = {}) => useQuery({
  queryKey: ['crm', 'stats', options.queryParams || {}],
  queryFn: async () => (await axios.get('/api/crm/stats', { params: options.queryParams })).data,
  enabled,
  staleTime: options.staleTime ?? 1000 * 60 * 2,
  refetchOnWindowFocus: options.refetchOnWindowFocus ?? false,
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

export const useLeadDetail = (leadId, enabled = true) => useQuery({
  queryKey: ['leads', 'detail', leadId],
  queryFn: async () => (await axios.get(`/api/crm/leads/${leadId}`)).data,
  enabled: enabled && !!leadId,
  staleTime: 1000 * 30,
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
    // ponytail: bookings/leads push via socket — no background poll
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: keepPreviousData,
  });
};

export const useLeadAudits = (params, enabled = true) => useQuery({
  queryKey: ['leadAudits', params],
  queryFn: async () => (await axios.get('/api/crm/leads/audit-logs', { params })).data,
  enabled,
  staleTime: 1000 * 30,
});
