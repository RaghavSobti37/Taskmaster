import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

export const useDepartments = (publicOnly = false) => useQuery({
  queryKey: ['departments', { publicOnly }],
  queryFn: async () => (await axios.get(publicOnly ? '/api/departments/public' : '/api/departments')).data,
  staleTime: 1000 * 60 * 10,
});

export const useCreateDepartment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => axios.post('/api/departments', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
  });
};

export const useUpdateDepartment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => axios.patch(`/api/departments/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

export const useDeleteDepartment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.delete(`/api/departments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
  });
};

export const useDepartmentMonthlyReport = (departmentId, month, rangeParams = {}, enabled = true) => {
  const { timeframe = '30d', startDate, endDate } = rangeParams;
  return useQuery({
    queryKey: ['departmentMonthlyReport', departmentId, month, timeframe, startDate, endDate],
    queryFn: async () => (await axios.get(`/api/departments/${departmentId}/monthly-report`, {
      params: { month, timeframe, startDate, endDate },
    })).data,
    enabled: enabled && !!departmentId && !!month,
  });
};

export const useTeamMonthlyReport = (month, rangeParams = {}, enabled = true) => {
  const { timeframe = '30d', startDate, endDate } = rangeParams;
  return useQuery({
    queryKey: ['teamMonthlyReport', month, timeframe, startDate, endDate],
    queryFn: async () => (await axios.get('/api/departments/team/monthly-report', {
      params: { month, timeframe, startDate, endDate },
    })).data,
    enabled: enabled && !!month,
  });
};
