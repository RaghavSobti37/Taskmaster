import { HUB_CONFIG } from './navbarConfig';
import { hasPageAccess } from './pagePermissions';

/** Maps sidebar paths to page permission keys (mirrors OutletSidebar PAGE_CONFIG). */
export const NAV_PATH_ACCESS = {
  '/dashboard': 'dashboard',
  '/calendar': 'calendar',
  '/todo': 'todo',
  '/inbox': 'inbox',
  '/projects': 'projects',
  '/assets': 'assets',
  '/schedule': 'schedule',
  '/logs': 'logs',
  '/notes': 'notes',
  '/emails': 'emails',
  '/equipment': 'equipment',
  '/contacts': 'contacts',
  '/subscriptions': 'subscriptions',
  '/attendance': 'attendance',
  '/leads': 'leads',
  '/followups': 'followups',
  '/bookings': 'bookings',
  '/finance': 'finance',
  '/announcements': 'announcements',
  '/ops-logs': 'ops_logs',
  '/artists': 'artists',
  '/admin/users': 'admin_users',
  '/admin/teams': 'admin_users',
  '/admin': 'admin_data',
  '/admin/exly-campaigns': 'admin_exly',
  '/admin/scripts': 'admin_scripts',
  '/admin/gamification': 'admin_gamification',
  '/admin/project-analytics': 'admin_project_analytics',
  '/admin/qa': 'admin_data',
  '/crm': 'crm_hub',
  '/office': 'office_hub',
  '/management': 'management_hub',
  '/admin/console': 'admin_console',
};

export function hasHubAccess(user, hubPath, hasPageAccess, hasAnyPageAccess) {
  const hub = HUB_CONFIG[hubPath];
  if (!hub) return false;
  return hasAnyPageAccess(user, hub.childKeys);
}

/** Management hub entry — artist managers land on Artists when ops tabs are hidden. */
export function getManagementHubPath(user, hasPageAccessFn = hasPageAccess) {
  const hub = HUB_CONFIG['/management'];
  const visibleTabs = (hub?.tabs || []).filter((tab) => hasPageAccessFn(user, tab.key));
  if (visibleTabs.length === 1 && visibleTabs[0].id === 'artists') {
    return '/management?tab=artists';
  }
  const defaultTab = visibleTabs.find((tab) => tab.id === hub?.defaultTab)?.id
    || visibleTabs[0]?.id;
  return defaultTab ? `/management?tab=${defaultTab}` : '/management';
}

export function canAccessNavPath(user, path, hasPageAccess, hasAnyPageAccess) {
  if (path === '/settings') return !!user;
  const key = NAV_PATH_ACCESS[path];
  if (!key) return true;
  if (key.endsWith('_hub') || key === 'admin_console') {
    const hubPath = key === 'crm_hub'
      ? '/crm'
      : key === 'office_hub'
        ? '/office'
        : key === 'management_hub'
          ? '/management'
          : '/admin/console';
    return hasHubAccess(user, hubPath, hasPageAccess, hasAnyPageAccess);
  }
  return hasPageAccess(user, key);
}

export function filterNavGroupsForUser(groups, user, hasPageAccess, hasAnyPageAccess) {
  return (groups || [])
    .map((group) => ({
      ...group,
      pages: (group.pages || []).filter((page) => {
        if (page.path === '/chat') return false;
        return canAccessNavPath(user, page.path, hasPageAccess, hasAnyPageAccess);
      }),
    }))
    .filter((group) => group.pages.length > 0);
}
