import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

export const orgDocumentsQueryKey = (filters = {}) => ['orgDocuments', filters];

export const useOrgDocuments = (filters = {}, enabled = true) => useQuery({
  queryKey: orgDocumentsQueryKey(filters),
  queryFn: async () => {
    const res = await axios.get('/api/org-documents', { params: filters });
    return res.data;
  },
  enabled,
  staleTime: 1000 * 60,
});

export const useCreateOrgDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => axios.post('/api/org-documents', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orgDocuments'] });
    },
  });
};

export const useUpdateOrgDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) => axios.patch(`/api/org-documents/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orgDocuments'] });
    },
  });
};

export const useDeleteOrgDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.delete(`/api/org-documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orgDocuments'] });
    },
  });
};
