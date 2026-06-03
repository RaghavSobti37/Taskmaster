import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export const useDashboardSummary = () => {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => (await axios.get('/api/dashboard/summary')).data,
    staleTime: 1000 * 60 * 2,
  });
};

export const useDepartmentStats = (timeframe = '7d', enabled = true) => {
  return useQuery({
    queryKey: ['dashboard', 'dept-stats', timeframe],
    queryFn: async () => (await axios.get(`/api/dashboard/dept-stats?timeframe=${timeframe}`)).data,
    enabled,
    staleTime: 1000 * 60 * 2,
  });
};

export const useDashboardPreset = () => {
  return useQuery({
    queryKey: ['dashboardPreset'],
    queryFn: async () => {
      const { data } = await axios.get('/api/customization/dashboard/preset');
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const savedLayoutOptionValue = (name) => `saved:${encodeURIComponent(name)}`;

export const parseSavedLayoutOptionValue = (value) => {
  if (!value?.startsWith('saved:')) return null;
  try {
    return decodeURIComponent(value.slice(6)).trim();
  } catch {
    return null;
  }
};
