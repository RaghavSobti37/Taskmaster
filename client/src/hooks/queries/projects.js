import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

export const useProjects = () => {
  const queryClient = useQueryClient();
  useEffect(() => {
    return subscribeToChannel('projects', 'project_change', () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
    });
  }, [queryClient]);

  return useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });
};

export const useWorkspaces = () => {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: fetchWorkspaces,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
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
