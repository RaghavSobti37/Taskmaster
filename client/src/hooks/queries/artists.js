import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

export const useArtists = () => useQuery({
  queryKey: ['artists'],
  queryFn: async () => (await axios.get('/api/artists')).data,
  staleTime: 1000 * 60 * 5,
});

export const useArtist = (id, enabled = true) => useQuery({
  queryKey: ['artist', id],
  queryFn: async () => (await axios.get(`/api/artists/${id}`)).data,
  enabled: !!id && enabled,
  staleTime: 1000 * 60 * 5,
});

export const useArtistPreview = (id, token, enabled = true) => useQuery({
  queryKey: ['artist-preview', id, token],
  queryFn: async () => (await axios.get(`/api/artists/${id}/preview`, { params: { token } })).data,
  enabled: !!id && !!token && enabled,
  staleTime: 1000 * 60 * 2,
});

export const useArtistAnalytics = (id, platform, timeframe = '30d', accountId = null, enabled = true) => useQuery({
  queryKey: [`artist-${platform}`, id, timeframe, accountId],
  queryFn: async () => {
    const params = { timeframe };
    if (accountId) params.accountId = accountId;
    return (await axios.get(`/api/artists/${id}/analytics/${platform}`, { params })).data;
  },
  enabled: !!id && !!platform && enabled,
  staleTime: 1000 * 60 * 5,
});

export const useCreateArtist = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newArtist) => axios.post('/api/artists', newArtist),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['artists'] }),
  });
};

export const useUpdateArtist = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => axios.put(`/api/artists/${id}`, data),
    onSuccess: (_res, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['artists'] });
      queryClient.invalidateQueries({ queryKey: ['artist', id] });
    },
  });
};

export const useDeleteArtist = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.delete(`/api/artists/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['artists'] }),
  });
};

export const useSyncArtistStats = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.post(`/api/artists/${id}/sync-stats`),
    onSuccess: (res, id) => {
      queryClient.setQueryData(['artist', id], res.data);
      queryClient.invalidateQueries({ queryKey: ['artists'] });
      queryClient.invalidateQueries({ queryKey: ['artist', id] });
      queryClient.invalidateQueries({ queryKey: ['artist-spotify', id] });
      queryClient.invalidateQueries({ queryKey: ['artist-youtube', id] });
      queryClient.invalidateQueries({ queryKey: ['artist-meta', id] });
    },
  });
};

export const useAddTrackedVideo = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => axios.post(`/api/artists/${id}/tracked-video`, data),
    onSuccess: (res, { id }) => {
      queryClient.setQueryData(['artist', id], res.data);
      queryClient.invalidateQueries({ queryKey: ['artists'] });
      queryClient.invalidateQueries({ queryKey: ['artist', id] });
      queryClient.invalidateQueries({ queryKey: ['artist-youtube', id] });
      queryClient.invalidateQueries({ queryKey: ['artist-spotify', id] });
      queryClient.invalidateQueries({ queryKey: ['artist-instagram', id] });
    },
  });
};

export const useCreateShareLink = () => useMutation({
  mutationFn: (id) => axios.post(`/api/artists/${id}/share-link`).then((r) => r.data),
});

export const useSetPrimaryConnection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ artistId, connectionId }) => axios.put(`/api/artists/${artistId}/connections/${connectionId}/primary`).then((r) => r.data),
    onSuccess: (_data, { artistId }) => {
      queryClient.invalidateQueries({ queryKey: ['artist', artistId] });
      queryClient.invalidateQueries({ queryKey: ['artists'] });
    },
  });
};
