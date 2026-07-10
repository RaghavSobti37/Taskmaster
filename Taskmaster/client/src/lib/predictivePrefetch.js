import { isAdminUser } from '../utils/departmentPermissions';
import { hasPageAccess } from '../utils/pagePermissions';
import { prefetchNavRoute } from './navPrefetch';

/** Role-aware idle prefetch after session ready. */
export function schedulePredictivePrefetch(userId, user) {
  if (!userId || typeof window === 'undefined') return;

  const routes = ['/dashboard', '/todo', '/inbox', '/projects', '/calendar'];

  if (hasPageAccess(user, 'crm') || hasPageAccess(user, 'leads')) {
    routes.push('/crm');
  }
  if (hasPageAccess(user, 'finance')) routes.push('/finance');
  if (isAdminUser(user)) {
    routes.push('/admin/console', '/admin/analytics');
  }

  const run = () => {
    routes.forEach((path) => prefetchNavRoute(path, userId, user));
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 8000 });
  } else {
    window.setTimeout(run, 2500);
  }
}
