import axios from 'axios';

import { queryClient } from './queryClient';

import { QUERY_STALE_TIMES } from './queryDefaults';

import { getNotificationsPayload } from '../utils/localNotificationStore';

import { notificationsQueryKey } from '../hooks/queries/notifications';

import { fetchCalendarEvents, getCalendarPrefetchRange } from '../hooks/queries/calendar';

import { normalizeProjects } from '../utils/projectUtils';
import { normalizeUserDirectory } from '../hooks/queries/logs';

import { crmQueryParamsForUser } from '../utils/crmScope';

const prefetched = new Set();

const DEFAULT_TODO_PARAMS = {
  page: 1,
  limit: 10,
  sort: 'dueDate',
  order: 'asc',
};

const ROUTE_CHUNK_LOADERS = {
  '/projects': () => import('../pages/projects/ProjectsView'),
  '/crm': () => import('../pages/crm/LeadsPage'),
};

function prefetchRouteChunk(path) {
  const loader = ROUTE_CHUNK_LOADERS[path];
  if (!loader) return;
  const key = `chunk:${path}`;
  if (prefetched.has(key)) return;
  prefetched.add(key);
  loader().catch(() => {
    prefetched.delete(key);
  });
}

function prefetchOnce(key, queryKey, queryFn, staleTime = QUERY_STALE_TIMES.moderate) {
  if (prefetched.has(key)) return;
  prefetched.add(key);
  queryClient.prefetchQuery({ queryKey, queryFn, staleTime });
}

/** Warm route chunks + common queries on sidebar hover. */
export function prefetchNavRoute(path, userId, user = null) {
  if (!path) return;

  if (path === '/todo' || path.startsWith('/todo')) {
    prefetchOnce('tasks-todo-default', ['tasks', 'todo', DEFAULT_TODO_PARAMS], async () => {
      const { data } = await axios.get('/api/tasks', { params: { scope: 'todo', ...DEFAULT_TODO_PARAMS } });
      return data;
    });
    return;
  }

  if (path === '/inbox') {
    if (!userId) return;
    prefetchOnce(
      `notifications-${userId}`,
      notificationsQueryKey(userId),
      async () => getNotificationsPayload(userId, ''),
      QUERY_STALE_TIMES.immutable,
    );
    return;
  }

  if (path === '/dashboard') {
    prefetchOnce(
      'dashboard-summary-calendar',
      ['dashboard', 'summary', 'calendar'],
      async () => (await axios.get('/api/dashboard/summary?fields=calendar')).data,
    );
    if (userId) {
      prefetchOnce(
        `dashboard-tasks-${userId}`,
        ['tasks', 'dashboard', userId],
        async () => {
          const { data } = await axios.get('/api/tasks', { params: { scope: 'dashboard' } });
          return data;
        },
      );
    }
    return;
  }

  if (path === '/projects' || path.startsWith('/projects')) {
    prefetchRouteChunk('/projects');
    prefetchOnce('projects', ['projects'], async () => {
      const { data } = await axios.get('/api/projects');
      return normalizeProjects(data);
    });
    return;
  }

  if (path === '/calendar' || path.startsWith('/calendar')) {
    const { start, end } = getCalendarPrefetchRange();
    prefetchOnce(
      `calendar-events-${start}`,
      ['calendarEvents', start, end],
      () => fetchCalendarEvents({ start, end }),
    );
    return;
  }

  if (path === '/crm' || path.startsWith('/crm') || path === '/leads' || path.startsWith('/leads')) {
    prefetchRouteChunk('/crm');
    const leadParams = crmQueryParamsForUser(user, { page: 1, limit: 10 });
    prefetchOnce(
      `leads-page-1-${leadParams.crmType || 'all'}`,
      ['leads', leadParams],
      async () => (await axios.get('/api/crm/leads', { params: leadParams })).data,
    );
    const statsParams = crmQueryParamsForUser(user, {});
    prefetchOnce(
      `crm-stats-${statsParams.crmType || 'all'}`,
      ['crm', 'stats', statsParams],
      async () => (await axios.get('/api/crm/stats', { params: statsParams })).data,
    );
    return;
  }

  if (path === '/notes' || path.startsWith('/notes')) {
    prefetchOnce('notes', ['notes'], async () => (await axios.get('/api/notes')).data);
    return;
  }

  if (path === '/assets' || path.startsWith('/assets')) {
    prefetchOnce('assets', ['assets'], async () => (await axios.get('/api/assets')).data);
    return;
  }

  if (path === '/management' || path.startsWith('/management') || path === '/artists') {
    prefetchOnce('artists', ['artists'], async () => (await axios.get('/api/artists')).data);
    return;
  }

  if (path === '/admin/console' || path.startsWith('/admin')) {
    prefetchOnce('user-directory', ['userDirectory'], async () =>
      normalizeUserDirectory((await axios.get('/api/users/directory?limit=1000')).data),
    );
    prefetchOnce('teams', ['teams'], async () => (await axios.get('/api/teams')).data);
  }
}

export function prefetchPrimaryRoutes(userId, user = null) {
  ['/dashboard', '/todo', '/inbox'].forEach((path) => prefetchNavRoute(path, userId, user));
}

export function scheduleIdlePrefetch(userId, user = null) {
  const run = () => prefetchPrimaryRoutes(userId, user);
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 5000 });
  } else {
    window.setTimeout(run, 2000);
  }
}
