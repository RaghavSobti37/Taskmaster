import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

// API Fetchers
const fetchLogs = async (userId, limit = 200) => {
  const { data } = await axios.get(`/api/logs?userId=${userId}&limit=${limit}`);
  return data;
};

const fetchProjects = async () => {
  const { data } = await axios.get('/api/projects');
  return data;
};

const fetchTasks = async () => {
  const { data } = await axios.get('/api/tasks');
  return data;
};

const fetchUserDirectory = async () => {
  const { data } = await axios.get('/api/users/directory');
  return data.users;
};

// Hooks
export const useLogs = (userId, limit) => {
  return useQuery({
    queryKey: ['logs', userId, limit],
    queryFn: () => fetchLogs(userId, limit),
    enabled: !!userId,
  });
};

export const useProjects = () => {
  return useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });
};

export const useTasks = (userId) => {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: fetchTasks,
    select: (tasks) => {
      if (!userId) return tasks;
      return tasks.filter(t =>
        t.assignees?.some(a => (typeof a === 'string' ? a : a._id) === userId)
      );
    }
  });
};

export const useUserDirectory = () => {
  return useQuery({
    queryKey: ['userDirectory'],
    queryFn: fetchUserDirectory,
  });
};

// Mutations
export const useCreateLog = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newLog) => axios.post('/api/logs', newLog),
    onMutate: async (newLog) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['logs'] });

      // Snapshot the previous value
      const previousLogs = queryClient.getQueryData(['logs', newLog.userId]);

      // Optimistically update to the new value
      if (previousLogs) {
        queryClient.setQueryData(['logs', newLog.userId], (old) => [
          { _id: 'temp-id-' + Date.now(), createdAt: new Date().toISOString(), ...newLog },
          ...old
        ]);
      }

      return { previousLogs };
    },
    onError: (err, newLog, context) => {
      // Rollback to the previous value if mutation fails
      if (context?.previousLogs) {
        queryClient.setQueryData(['logs', newLog.userId], context.previousLogs);
      }
    },
    onSettled: (data, error, variables) => {
      // Invalidate and refetch on success or error
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    },
  });
};
