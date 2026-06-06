import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import axios from 'axios';

export const useArtistPathPeople = (params = {}, options = {}) => useQuery({
  queryKey: ['artistPath', 'people', params],
  queryFn: async () => (await axios.get('/api/artist-path/people', { params })).data,
  placeholderData: keepPreviousData,
  staleTime: 1000 * 60 * 5,
  ...options,
});

export const useArtistPathPerson = (personId, options = {}) => useQuery({
  queryKey: ['artistPath', 'person', personId],
  queryFn: async () => (await axios.get(`/api/artist-path/people/${personId}`)).data,
  enabled: !!personId,
  staleTime: 1000 * 60 * 2,
  ...options,
});

export const useArtistPathSync = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => axios.post('/api/artist-path/sync'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artistPath'] });
      queryClient.invalidateQueries({ queryKey: ['dataHub'] });
    },
  });
};
