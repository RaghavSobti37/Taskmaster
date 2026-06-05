import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { invalidateStatusCounts } from '../../lib/queryInvalidation';

export const useNotifications = (enabled = true) => useQuery({
  queryKey: ['notifications'],
  queryFn: async () => (await axios.get('/api/notifications')).data,
  enabled,
  staleTime: 1000 * 15,
  refetchInterval: 1000 * 30,
  refetchOnWindowFocus: true,
});

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.patch(`/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      invalidateStatusCounts(queryClient);
    },
  });
};

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => axios.patch('/api/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      invalidateStatusCounts(queryClient);
    },
  });
};

export const useClearAllNotifications = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => axios.delete('/api/notifications'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      invalidateStatusCounts(queryClient);
    },
  });
};
