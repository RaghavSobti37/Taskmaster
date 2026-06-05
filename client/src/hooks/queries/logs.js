import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import axios from 'axios';
import { subscribeToChannel } from '../../lib/realtime';

const fetchLogs = async (userId, limit = 200) => {
  const { data } = await axios.get(`/api/logs?userId=${userId}&limit=${limit}`);
  return data;
};

export const useLogs = (userId, limit = 200, enabled = true) => {
  const queryClient = useQueryClient();
  useEffect(() => {
    return subscribeToChannel('logs', 'log_update', () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    });
  }, [queryClient]);

  return useQuery({
    queryKey: ['logs', userId, limit],
    queryFn: () => fetchLogs(userId === 'all' || !userId ? undefined : userId, limit),
    enabled,
    placeholderData: keepPreviousData,
  });
};

export const useUserDirectory = (enabled = true) => useQuery({
  queryKey: ['userDirectory'],
  queryFn: async () => (await axios.get('/api/users/directory?limit=1000')).data.users,
  enabled,
  staleTime: 1000 * 60 * 30,
  gcTime: 1000 * 60 * 60,
  refetchOnWindowFocus: false,
});

export const useActivityGrid = () => useQuery({
  queryKey: ['logs', 'activityGrid'],
  queryFn: async () => (await axios.get('/api/logs/activity-grid')).data,
  staleTime: 1000 * 60 * 10,
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
