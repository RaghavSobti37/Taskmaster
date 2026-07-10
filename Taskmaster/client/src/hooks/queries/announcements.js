import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

export const useAnnouncements = (enabled = true, refetchInterval = false, includeExpired = false) => useQuery({
  queryKey: ['announcements', { includeExpired }],
  queryFn: async () => (await axios.get('/api/announcements', { params: { includeExpired } })).data,
  enabled,
  staleTime: 1000 * 60,
  refetchInterval,
});

export const useAnnouncementTargets = (enabled = true) => useQuery({
  queryKey: ['announcementTargets'],
  queryFn: async () => (await axios.get('/api/announcements/targets')).data,
  enabled,
  staleTime: 1000 * 60 * 5,
});

export const useCreateAnnouncement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => axios.post('/api/announcements', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
    },
  });
};

export const useDeleteAnnouncement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.delete(`/api/announcements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
    },
  });
};
