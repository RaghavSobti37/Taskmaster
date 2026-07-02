import { HUB_CONFIG } from './navbarConfig';
import { hasPageAccess, hasAnyPageAccess } from './pagePermissions';

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
  '/artists': 'artists',
  '/admin/users': 'admin_users',
  '/admin/platform-settings': 'admin_users',
  '/admin/teams': 'admin_teams',
  '/admin/roles': 'admin_roles',
  '/admin': 'admin_data',
  '/admin/ops-hub': 'admin_ops_hub',
  '/admin/knowledge-engine': 'admin_knowledge_engine',
  '/admin/exly-campaigns': 'admin_exly',
  '/admin/scripts': 'admin_scripts',
  '/admin/gamification': 'admin_gamification',
  '/admin/project-analytics': 'admin_project_analytics',
  '/admin/artist-path': 'admin_artist_path',
  '/admin/qa': 'admin_data',
  '/admin/lead-audits': 'admin_data',
  '/admin/crm-stats': 'admin_data',
  '/admin/media-list': 'admin_data',
  '/admin/control': 'admin_data',
  '/campaign': 'campaigns',
  '/crm': 'crm_hub',
  '/office': 'office_hub',
  '/management': 'management_hub',
  '/admin/console': 'admin_console',
  '/settings': 'settings',
  '/office-assets': 'office_assets',
  '/features': 'features',
  '/workflows': 'workflows',
};

/** Nested routes inherit parent page key (longest prefix wins). */
const NAV_PATH_PREFIXES = [
  ['/admin/ops-hub', 'admin_ops_hub'],
  ['/admin/knowledge-engine', 'admin_knowledge_engine'],
  ['/admin/control', 'admin_data'],
  ['/admin/teams', 'admin_teams'],
  ['/admin/users', 'admin_users'],
  ['/admin/roles', 'admin_roles'],
  ['/admin/artist-path', 'admin_artist_path'],
  ['/admin/exly-campaigns', 'admin_exly'],
  ['/admin/scripts', 'admin_scripts'],
  ['/admin/gamification', 'admin_gamification'],
  ['/admin/project-analytics', 'admin_project_analytics'],
  ['/admin/qa', 'admin_data'],
  ['/admin/lead-audits', 'admin_data'],
  ['/admin/crm-stats', 'admin_data'],
  ['/admin/media-list', 'admin_data'],
  ['/campaign', 'campaigns'],
  ['/emails', 'emails'],
  ['/projects', 'projects'],
  ['/workspaces', 'projects'],
  ['/artists', 'artists'],
  ['/notes', 'notes'],
  ['/assets', 'assets'],
  ['/attendance', 'attendance'],
];

export function resolveNavAccessKey(path) {
  const base = (path || '').split('?')[0];
  if (!base) return null;
  if (NAV_PATH_ACCESS[base]) return NAV_PATH_ACCESS[base];
  const sorted = [...NAV_PATH_PREFIXES].sort((a, b) => b[0].length - a[0].length);
  for (const [prefix, key] of sorted) {
    if (base === prefix || base.startsWith(`${prefix}/`)) return key;
  }
  return null;
}

export function hasHubAccess(user, hubPath, hasPageAccessFn, hasAnyPageAccessFn) {
  const hub = HUB_CONFIG[hubPath];
  if (!hub) return false;
  return hasAnyPageAccessFn(user, hub.childKeys);
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

export function canAccessNavPath(user, path, hasPageAccessFn = hasPageAccess, hasAnyPageAccessFn = hasAnyPageAccess) {
  if (!user) return false;
  const key = resolveNavAccessKey(path);
  if (!key) return false;
  if (key.endsWith('_hub') || key === 'admin_console') {
    const hubPath = key === 'crm_hub'
      ? '/crm'
      : key === 'office_hub'
        ? '/office'
        : key === 'management_hub'
          ? '/management'
          : '/admin/console';
    return hasHubAccess(user, hubPath, hasPageAccessFn, hasAnyPageAccessFn);
  }
  return hasPageAccessFn(user, key);
}

/** Strip query string and gate palette / G-chord actions by page permissions. */
export function filterActionsByPageAccess(actions, user) {
  if (!user) return [];
  return (actions || []).filter((action) => {
    if (!action.path) return true;
    const basePath = action.path.split('?')[0];
    return canAccessNavPath(user, basePath, hasPageAccess, hasAnyPageAccess);
  });
}

/** Gate quick-add palette actions by destination page. */
export const QUICK_ACTION_PAGE_KEYS = {
  task: 'todo',
  log: 'logs',
  note: 'notes',
  event: 'calendar',
  asset: 'assets',
  pin: 'schedule',
};

export function filterQuickActionsByPageAccess(actions, user) {
  if (!user) return [];
  return (actions || []).filter((action) => {
    const pageKey = QUICK_ACTION_PAGE_KEYS[action.quickActionId];
    if (!pageKey) return true;
    return hasPageAccess(user, pageKey);
  });
}

export function filterNavGroupsForUser(groups, user, hasPageAccessFn = hasPageAccess, hasAnyPageAccessFn = hasAnyPageAccess) {
  return (groups || [])
    .map((group) => ({
      ...group,
      pages: (group.pages || []).filter((page) => {
        if (page.path === '/chat') return false;
        return canAccessNavPath(user, page.path, hasPageAccessFn, hasAnyPageAccessFn);
      }),
    }))
    .filter((group) => group.pages.length > 0);
}
