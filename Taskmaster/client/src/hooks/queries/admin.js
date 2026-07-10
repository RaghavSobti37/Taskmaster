import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

export const useTeams = (enabled = true) => useQuery({
  queryKey: ['teams'],
  queryFn: async () => (await axios.get('/api/teams')).data,
  staleTime: 1000 * 60 * 10,
  enabled,
});

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => axios.put(`/api/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userDirectory'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.delete(`/api/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userDirectory'] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => (await axios.post('/api/users', data)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['userDirectory'] }),
  });
};

export const useCreateTeam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => axios.post('/api/teams', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teams'] }),
  });
};

export const useDeleteTeam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.delete(`/api/teams/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teams'] }),
  });
};

export const usePlatformExclusions = (enabled = true) => useQuery({
  queryKey: ['platform-exclusions'],
  queryFn: async () => (await axios.get('/api/admin/platform-settings/exclusions')).data,
  staleTime: 1000 * 60 * 5,
  enabled,
});

const useUpdateUserDepartment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, departmentId }) => axios.patch(`/api/departments/users/${userId}`, { departmentId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
};
