import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import axios from 'axios';
import { subscribeToChannel } from '../../lib/realtime';

const fetchLogs = async (userId, { limit = 200, startDate, endDate, action } = {}) => {
  const params = { limit };
  if (userId && userId !== 'all') params.userId = userId;
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  if (action) params.action = action;
  const { data } = await axios.get('/api/logs', { params });
  return data;
};

export const useLogs = (userId, options = {}, enabled = true) => {
  const opts = typeof options === 'number' ? { limit: options } : options;
  const { limit = 200, startDate, endDate, action } = opts;

  const queryClient = useQueryClient();
  useEffect(() => {
    return subscribeToChannel('logs', 'log_update', () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    });
  }, [queryClient]);

  const canFetch = userId === 'all' || Boolean(userId);

  return useQuery({
    queryKey: ['logs', userId, limit, startDate, endDate, action],
    queryFn: () => fetchLogs(userId === 'all' || !userId ? undefined : userId, { limit, startDate, endDate, action }),
    enabled: enabled && canFetch,
    placeholderData: keepPreviousData,
  });
};

/** Always return an array — guards stale cache / partial API payloads. */
export function normalizeUserDirectory(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.users)) return payload.users;
  return [];
}

export const useUserDirectory = (enabled = true) => useQuery({
  queryKey: ['userDirectory'],
  queryFn: async () => (await axios.get('/api/users/directory?limit=1000')).data,
  select: normalizeUserDirectory,
  enabled,
  staleTime: 1000 * 60 * 30,
  gcTime: 1000 * 60 * 60,
  refetchOnWindowFocus: false,
});

export const useActivityGrid = (enabled = true) => useQuery({
  queryKey: ['logs', 'activityGrid'],
  queryFn: async () => (await axios.get('/api/logs/activity-grid')).data,
  staleTime: 1000 * 60 * 10,
  enabled,
});

export const useCreateLog = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newLog) => axios.post('/api/logs', newLog),
    onMutate: async (newLog) => {
      await queryClient.cancelQueries({ queryKey: ['logs'] });
      const previousLogs = queryClient.getQueryData(['logs', newLog.userId]);
      if (previousLogs) {
        queryClient.setQueryData(['logs', newLog.userId], (old) => [
          { _id: `temp-id-${Date.now()}`, createdAt: new Date().toISOString(), ...newLog },
          ...(old || []),
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
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['projects', 'analytics-summary'] });
      queryClient.invalidateQueries({
        queryKey: ['projects'],
        predicate: (q) => q.queryKey[2] === 'analytics',
      });
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
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['projects', 'analytics-summary'] });
      queryClient.invalidateQueries({
        queryKey: ['projects'],
        predicate: (q) => q.queryKey[2] === 'analytics',
      });
    },
  });
};

export const useDeleteLog = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.delete(`/api/logs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['projects', 'analytics-summary'] });
      queryClient.invalidateQueries({
        queryKey: ['projects'],
        predicate: (q) => q.queryKey[2] === 'analytics',
      });
    },
  });
};
