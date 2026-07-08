import axios from 'axios';
import { normalizeProjects } from '../utils/projectUtils';
import { crmQueryParamsForUser } from '../utils/crmScope';
import { QUERY_STALE_TIMES } from './queryDefaults';

/** TanStack Query factories — single source for keys + fetchers. */
export const projectQueries = {
  list: () => ({
    queryKey: ['projects'],
    queryFn: async () => normalizeProjects((await axios.get('/api/projects')).data),
    staleTime: QUERY_STALE_TIMES.moderate,
  }),
  detail: (id) => ({
    queryKey: ['projects', id],
    queryFn: async () => (await axios.get(`/api/projects/${id}`)).data,
    enabled: Boolean(id),
  }),
};

export const leadQueries = {
  page: (user, page = 1, limit = 10) => {
    const params = crmQueryParamsForUser(user, { page, limit });
    return {
      queryKey: ['leads', params],
      queryFn: async () => (await axios.get('/api/crm/leads', { params })).data,
      staleTime: QUERY_STALE_TIMES.moderate,
    };
  },
};

export const taskQueries = {
  todo: (params = { page: 1, limit: 10, sort: 'dueDate', order: 'asc' }) => ({
    queryKey: ['tasks', 'todo', params],
    queryFn: async () =>
      (await axios.get('/api/tasks', { params: { scope: 'todo', ...params } })).data,
    staleTime: QUERY_STALE_TIMES.moderate,
  }),
};
