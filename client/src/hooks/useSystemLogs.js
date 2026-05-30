import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { subscribeToChannel } from '../lib/realtime';

const fetchSystemLogs = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.module) params.set('module', filters.module);
  if (filters.severity) params.set('severity', filters.severity);
  if (filters.traceId) params.set('traceId', filters.traceId);
  if (filters.search) params.set('search', filters.search);
  if (filters.excludePageViews) params.set('excludePageViews', 'true');
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  const { data } = await axios.get(`/api/system-logs?${params.toString()}`);
  return data;
};

const fetchTopPages = async (days = 7) => {
  const { data } = await axios.get(`/api/system-logs/analytics/top-pages?days=${days}`);
  return data;
};

export const useSystemLogs = (filters = {}, enabled = true) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['systemLogs', filters],
    queryFn: () => fetchSystemLogs(filters),
    enabled,
    refetchInterval: 30000,
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    if (!enabled) return undefined;

    return subscribeToChannel('system-logs', 'system_log', (payload) => {
      if (payload.errorCode === 'PAGE_VIEW' && filters.excludePageViews) return;
      queryClient.setQueryData(['systemLogs', filters], (old) => {
        if (!old?.logs) return old;
        if (old.logs.some((l) => l._id === payload._id)) return old;
        return {
          ...old,
          logs: [payload, ...old.logs].slice(0, filters.limit || 50),
          pagination: {
            ...old.pagination,
            total: (old.pagination?.total || 0) + 1,
          },
        };
      });
    });
  }, [enabled, filters, queryClient]);

  return query;
};

export const useTopPages = (days = 7, enabled = true) => {
  return useQuery({
    queryKey: ['topPages', days],
    queryFn: () => fetchTopPages(days),
    enabled,
    refetchInterval: 60000,
  });
};

export const useSystemLogTrail = (traceId, enabled = true) => {
  return useQuery({
    queryKey: ['systemLogTrail', traceId],
    queryFn: async () => {
      const { data } = await axios.get(`/api/system-logs/${encodeURIComponent(traceId)}/trail`);
      return data;
    },
    enabled: Boolean(traceId) && enabled,
  });
};
