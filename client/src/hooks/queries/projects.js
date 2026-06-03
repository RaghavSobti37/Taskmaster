import { useEffect } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import axios from 'axios';
import { subscribeToChannel } from '../../lib/realtime';
import { normalizeProject, normalizeProjects } from '../../utils/projectUtils';

const fetchProjects = async () => {
  const { data } = await axios.get('/api/projects');
  return normalizeProjects(data);
};

const fetchWorkspaces = async () => {
  const { data } = await axios.get('/api/projects/workspaces');
  return data;
};

const fetchWorkspaceByName = async (name) => {
  const { data } = await axios.get(`/api/projects/workspaces/${encodeURIComponent(name)}`);
  return data;
};

const fetchProjectById = async (id) => {
  const { data } = await axios.get(`/api/projects/${id}`);
  return normalizeProject(data);
};

export const useProjects = (enabled = true) => {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) return undefined;
    return subscribeToChannel('projects', 'project_change', () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['projects', 'analytics-summary'] });
    });
  }, [queryClient]);

  return useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    enabled,
  });
};

export const useWorkspaces = (enabled = true) => {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: fetchWorkspaces,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    enabled,
  });
};

export const useWorkspace = (name) => {
  return useQuery({
    queryKey: ['workspaces', name],
    queryFn: () => fetchWorkspaceByName(name),
    enabled: !!name,
    staleTime: 1000 * 60 * 2,
  });
};

export const useProject = (id) => {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: () => fetchProjectById(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
};

export const useProjectAnalytics = (projectId, queryParams, queryEnabled = true) => {
  const { timeframe, startDate, endDate } = queryParams || {};
  return useQuery({
    queryKey: ['projects', projectId, 'analytics', timeframe, startDate, endDate],
    queryFn: async () =>
      (await axios.get(`/api/projects/${projectId}/analytics`, { params: queryParams })).data,
    enabled: !!projectId && queryEnabled,
    staleTime: 1000 * 60,
    placeholderData: keepPreviousData,
  });
};

export const useProjectsAnalyticsSummary = (queryParams, queryEnabled = true) => {
  const { timeframe, startDate, endDate } = queryParams || {};
  return useQuery({
    queryKey: ['projects', 'analytics-summary', timeframe, startDate, endDate],
    queryFn: async () =>
      (await axios.get('/api/projects/analytics-summary', { params: queryParams })).data,
    enabled: queryEnabled,
    staleTime: 1000 * 60,
    placeholderData: keepPreviousData,
  });
};

export const invalidateProjectAnalytics = (queryClient, projectId) => {
  queryClient.invalidateQueries({ queryKey: ['projects', 'analytics-summary'] });
  if (projectId) {
    queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'analytics'] });
  } else {
    queryClient.invalidateQueries({ queryKey: ['projects'], predicate: (q) => q.queryKey[2] === 'analytics' });
  }
};
