import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const fetchAssets = async () => (await axios.get('/api/assets')).data;

const fetchGoogleAccounts = async () => {
  try {
    return (await axios.get('/api/google/accounts')).data;
  } catch {
    return [];
  }
};

export const useAssets = (enabled = true) => useQuery({
  queryKey: ['assets'],
  queryFn: fetchAssets,
  enabled,
  staleTime: 1000 * 60 * 5,
});

export const useGoogleAccounts = (enabled = true) => useQuery({
  queryKey: ['googleAccounts'],
  queryFn: fetchGoogleAccounts,
  enabled,
  staleTime: 1000 * 60 * 5,
  retry: false,
});

export const useCreateAsset = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => axios.post('/api/assets', payload).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.setQueryData(['assets'], (old) => [data, ...(old || [])]);
    },
  });
};

export const useUpdateAsset = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => axios.put(`/api/assets/${id}`, payload).then((r) => r.data),
    onSuccess: (data, { id }) => {
      queryClient.setQueryData(['assets'], (old) =>
        (old || []).map((a) => (a._id === id ? data : a)));
    },
  });
};

export const useDeleteAsset = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.delete(`/api/assets/${id}`),
    onSuccess: (_result, id) => {
      queryClient.setQueryData(['assets'], (old) => (old || []).filter((a) => a._id !== id));
    },
  });
};

export const useUnlinkGoogleAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.delete(`/api/google/accounts/${id}`),
    onSuccess: (_result, id) => {
      queryClient.setQueryData(['googleAccounts'], (old) =>
        (old || []).filter((acc) => acc._id !== id));
    },
  });
};

export const refreshGoogleAccounts = (queryClient) =>
  queryClient.fetchQuery({ queryKey: ['googleAccounts'], queryFn: fetchGoogleAccounts });
