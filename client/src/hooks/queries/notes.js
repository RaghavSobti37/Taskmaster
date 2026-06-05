import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

export const useUserNotes = (enabled = true) => useQuery({
  queryKey: ['notes'],
  queryFn: async () => (await axios.get('/api/notes')).data,
  enabled,
  staleTime: 1000 * 30,
});

export const useNote = (id, enabled = true) => useQuery({
  queryKey: ['notes', id],
  queryFn: async () => (await axios.get(`/api/notes/${id}`)).data,
  enabled: enabled && !!id,
  staleTime: 1000 * 15,
});

export const useCreateNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => axios.post('/api/notes', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes'] }),
  });
};

export const useUpdateNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => axios.put(`/api/notes/${id}`, data),
    onSuccess: (_r, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      if (id) queryClient.invalidateQueries({ queryKey: ['notes', id] });
    },
  });
};

export const useDeleteNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.delete(`/api/notes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes'] }),
  });
};

export const usePinBoard = (enabled = true) => useQuery({
  queryKey: ['pinboard'],
  queryFn: async () => (await axios.get('/api/pinboard')).data,
  enabled,
  staleTime: 1000 * 30,
});

export const useCreatePin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => axios.post('/api/pinboard', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pinboard'] }),
  });
};

export const useUpdatePin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => axios.put(`/api/pinboard/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pinboard'] }),
  });
};

export const useDeletePin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.delete(`/api/pinboard/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pinboard'] }),
  });
};
