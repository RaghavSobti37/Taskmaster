import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  mergeTaskCategoryOptions,
  slugifyTaskCategoryInput,
} from '../constants/taskOptions';

export const TASK_CATEGORY_TYPES_KEY = ['taskCategoryTypes'];

export function useTaskCategoryOptions() {
  const queryClient = useQueryClient();
  const { data: remoteTypes = [], isLoading } = useQuery({
    queryKey: TASK_CATEGORY_TYPES_KEY,
    queryFn: async () => (await axios.get('/api/departments/task-types')).data,
    staleTime: 1000 * 60 * 5,
  });

  const options = useMemo(() => mergeTaskCategoryOptions(remoteTypes), [remoteTypes]);

  const addCategory = useMutation({
    mutationFn: async (label) => {
      const name = slugifyTaskCategoryInput(label);
      if (!name) throw new Error('Invalid category name');
      return (await axios.post('/api/departments/task-types', { name, label: String(label || '').trim() || undefined })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASK_CATEGORY_TYPES_KEY });
    },
  });

  return { options, isLoading, addCategory };
}
