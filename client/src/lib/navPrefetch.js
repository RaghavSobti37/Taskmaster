import axios from 'axios';
import { queryClient } from './queryClient';

const prefetched = new Set();

function prefetchOnce(key, queryKey, queryFn) {
  if (prefetched.has(key)) return;
  prefetched.add(key);
  queryClient.prefetchQuery({ queryKey, queryFn, staleTime: 60_000 });
}

/** Warm common routes during idle time (sidebar hover + app boot). */
export function prefetchNavRoute(path, userId) {
  if (!path) return;
  if (path === '/todo' || path.startsWith('/todo')) {
    prefetchOnce('tasks', ['tasks'], async () => {
      const { data } = await axios.get('/api/tasks', { params: { includeOldCompleted: '1' } });
      return Array.isArray(data) ? data : data?.tasks || [];
    });
    return;
  }
  if (path === '/inbox') {
    prefetchOnce('notifications', ['notifications'], async () => (await axios.get('/api/notifications')).data);
    return;
  }
  if (path === '/dashboard') {
    prefetchOnce('dashboard-summary', ['dashboard', 'summary'], async () => (await axios.get('/api/dashboard/summary')).data);
    return;
  }
  if (path === '/projects') {
    prefetchOnce('projects', ['projects'], async () => (await axios.get('/api/projects')).data);
    return;
  }
  if (path === '/calendar') {
    prefetchOnce('calendar', ['calendar'], async () => (await axios.get('/api/calendar')).data);
    return;
  }
  if (path === '/leads') {
    prefetchOnce('leads', ['leads', { page: 1, limit: 25 }], async () => (await axios.get('/api/crm/leads', { params: { page: 1, limit: 25 } })).data);
    return;
  }
  if (path === '/notes') {
    prefetchOnce('notes', ['notes'], async () => (await axios.get('/api/notes')).data);
  }
}

export function prefetchPrimaryRoutes(userId) {
  ['/dashboard', '/todo', '/inbox'].forEach((path) => prefetchNavRoute(path, userId));
}

export function scheduleIdlePrefetch(userId) {
  const run = () => prefetchPrimaryRoutes(userId);
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 5000 });
  } else {
    window.setTimeout(run, 2000);
  }
}
