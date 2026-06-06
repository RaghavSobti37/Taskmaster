import { useQuery, keepPreviousData } from '@tanstack/react-query';
import axios from 'axios';
import { normalizeSchedulePayload } from '../../utils/normalizeTask';

export const useSchedule = ({ start, end, projectId, departmentId } = {}, enabled = true) => {
  return useQuery({
    queryKey: ['schedule', start, end, projectId, departmentId],
    queryFn: async () =>
      (
        await axios.get('/api/schedule', {
          params: { start, end, projectId, departmentId },
        })
      ).data,
    select: (data) => normalizeSchedulePayload(data),
    enabled: enabled && !!start && !!end,
    staleTime: 1000 * 30,
    placeholderData: keepPreviousData,
  });
};

const useProjectWorkload = (projectId, start, end, enabled = true) => {
  return useQuery({
    queryKey: ['projects', projectId, 'workload', start, end],
    queryFn: async () =>
      (await axios.get(`/api/projects/${projectId}/workload`, { params: { start, end } })).data,
    enabled: enabled && !!projectId,
    staleTime: 1000 * 30,
  });
};

export const useProjectHoursSummary = (projectId, enabled = true) => {
  return useQuery({
    queryKey: ['projects', projectId, 'hours-summary'],
    queryFn: async () => (await axios.get(`/api/projects/${projectId}/hours-summary`)).data,
    enabled: enabled && !!projectId,
    staleTime: 1000 * 60 * 2,
  });
};
