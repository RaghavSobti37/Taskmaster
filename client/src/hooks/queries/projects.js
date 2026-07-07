import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { subscribeToChannel } from '../../lib/realtime';
import { normalizeProject, normalizeProjects } from '../../utils/projectUtils';
import { normalizeWorkspaceKey } from '../../utils/workspaceColors';
import { invalidateStatusCounts } from '../../lib/queryInvalidation';
import useTenantQueryKey from '../useTenantQueryKey';

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

export const useWorkspace = (name, enabled = true) => {
  const queryKey = useTenantQueryKey('workspaces', normalizeWorkspaceKey(name));
  return useQuery({
    queryKey,
    queryFn: () => fetchWorkspaceByName(name),
    enabled: enabled && !!name,
    staleTime: 1000 * 60 * 2,
    refetchOnMount: 'always',
  });
};

const fetchProjectById = async (id) => {
  const { data } = await axios.get(`/api/projects/${id}`);
  return normalizeProject(data);
};

export const useProjects = (enabled = true) => {
  const queryClient = useQueryClient();
  const projectsKey = useTenantQueryKey('projects');
  const workspacesKey = useTenantQueryKey('workspaces');
  const analyticsSummaryKey = useTenantQueryKey('projects', 'analytics-summary');
  const dashboardSummaryKey = useTenantQueryKey('dashboard', 'summary');
  useEffect(() => {
    if (!enabled) return undefined;
    return subscribeToChannel('projects', 'project_change', () => {
      queryClient.invalidateQueries({ queryKey: projectsKey });
      queryClient.invalidateQueries({ queryKey: workspacesKey });
      queryClient.invalidateQueries({ queryKey: dashboardSummaryKey });
      queryClient.invalidateQueries({ queryKey: analyticsSummaryKey });
      invalidateStatusCounts(queryClient);
    });
  }, [queryClient, enabled, projectsKey, workspacesKey, dashboardSummaryKey, analyticsSummaryKey]);

  return useQuery({
    queryKey: projectsKey,
    queryFn: fetchProjects,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: 'always',
    enabled,
  });
};

export const useWorkspaces = (enabled = true) => {
  const queryKey = useTenantQueryKey('workspaces');
  return useQuery({
    queryKey,
    queryFn: fetchWorkspaces,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: 'always',
    enabled,
  });
};

export const useProject = (id) => {
  const queryKey = useTenantQueryKey('projects', id);
  return useQuery({
    queryKey,
    queryFn: () => fetchProjectById(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
};

export const useProjectAnalytics = (projectId, queryParams, queryEnabled = true) => {
  const { timeframe, startDate, endDate } = queryParams || {};
  const queryKey = useTenantQueryKey('projects', projectId, 'analytics', timeframe, startDate, endDate);
  return useQuery({
    queryKey,
    queryFn: async () =>
      (await axios.get(`/api/projects/${projectId}/analytics`, { params: queryParams })).data,
    enabled: !!projectId && queryEnabled,
    staleTime: 0,
    refetchOnMount: 'always',
  });
};

export const useProjectsAnalyticsSummary = (queryParams, queryEnabled = true) => {
  const { timeframe, startDate, endDate } = queryParams || {};
  const queryKey = useTenantQueryKey('projects', 'analytics-summary', timeframe, startDate, endDate);
  return useQuery({
    queryKey,
    queryFn: async () =>
      (await axios.get('/api/projects/analytics-summary', { params: queryParams })).data,
    enabled: queryEnabled,
    staleTime: 0,
    refetchOnMount: 'always',
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => axios.put(`/api/projects/${id}`, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['projects'] });
      const previousProjects = queryClient.getQueryData(['projects']);
      const previousProject = queryClient.getQueryData(['projects', id]);
      if (previousProject) {
        queryClient.setQueryData(['projects', id], { ...previousProject, ...data });
      }
      if (previousProjects) {
        queryClient.setQueryData(['projects'], (old) =>
          (old || []).map((p) => (p._id === id ? { ...p, ...data } : p)));
      }
      return { previousProjects, previousProject };
    },
    onError: (err, variables, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(['projects'], context.previousProjects);
      }
      if (context?.previousProject) {
        queryClient.setQueryData(['projects', variables.id], context.previousProject);
      }
    },
    onSettled: (_data, _error, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['projects', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};

const invalidateProjectAnalytics = (queryClient, projectId) => {
  queryClient.invalidateQueries({ queryKey: ['projects', 'analytics-summary'] });
  if (projectId) {
    queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'analytics'] });
  } else {
    queryClient.invalidateQueries({ queryKey: ['projects'], predicate: (q) => q.queryKey[2] === 'analytics' });
  }
};
