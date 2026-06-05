import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export const sanitizeValue = (value, suffix = '') => {
  if (value === undefined || value === null || value === '' || value === 'Unavailable' || Number.isNaN(value)) {
    return 'N/A';
  }
  return `${value}${suffix}`;
};

export const useContacts = (enabled = true) => useQuery({
  queryKey: ['contacts'],
  queryFn: async () => (await axios.get('/api/contacts')).data,
  enabled,
  staleTime: 1000 * 60 * 5,
});

/** @deprecated Prefer TASK_CATEGORY_OPTIONS — returns general task categories. */
export const useTaskTypes = () => {
  const categories = [
    { name: 'bug', label: 'Bug' },
    { name: 'feature', label: 'Feature' },
    { name: 'content', label: 'Content' },
    { name: 'design', label: 'Design' },
    { name: 'ops', label: 'Operations' },
    { name: 'review', label: 'Review' },
    { name: 'sales', label: 'Sales' },
    { name: 'general', label: 'General' },
  ];
  return useQuery({
    queryKey: ['taskCategories'],
    queryFn: async () => categories,
    staleTime: Infinity,
    initialData: categories,
  });
};
