// @ts-check

/** @type {Record<string, { path: string, label: string }>} */
export const PERMISSION_ROUTES = {
  dashboard: { path: '/dashboard', label: 'Dashboard' },
  calendar: { path: '/calendar', label: 'Calendar' },
  todo: { path: '/todo', label: 'Todo' },
  inbox: { path: '/inbox', label: 'Inbox' },
  projects: { path: '/projects', label: 'Projects' },
  assets: { path: '/assets', label: 'Assets' },
  schedule: { path: '/schedule', label: 'Schedule' },
  logs: { path: '/logs', label: 'Daily Logs' },
  notes: { path: '/notes', label: 'Notes' },
  attendance: { path: '/attendance', label: 'Attendance' },
};

const CRM_PERMS = ['leads', 'followups', 'bookings'];
const OFFICE_PERMS = ['equipment', 'contacts', 'subscriptions'];
const MGMT_PERMS = ['finance', 'announcements', 'artists'];
const ADMIN_PERMS = [
  'admin_users',
  'admin_teams',
  'admin_data',
  'admin_exly',
  'admin_scripts',
  'admin_gamification',
  'admin_project_analytics',
];

/** @type {Array<{ path: string, label: string, archetypes: string[] }>} */
export const LEGACY_ROUTES_BY_ARCHETYPE = [
  { path: '/dashboard', label: 'Dashboard', archetypes: ['admin', 'user', 'sales', 'ops'] },
  { path: '/projects', label: 'Projects', archetypes: ['admin', 'user', 'sales', 'ops'] },
  { path: '/todo', label: 'Todo', archetypes: ['admin', 'user', 'sales', 'ops'] },
  { path: '/inbox', label: 'Inbox', archetypes: ['admin', 'user', 'sales', 'ops'] },
  { path: '/attendance', label: 'Attendance', archetypes: ['admin', 'user', 'sales', 'ops'] },
  { path: '/calendar', label: 'Calendar', archetypes: ['admin', 'user', 'sales', 'ops'] },
  { path: '/logs', label: 'Daily Logs', archetypes: ['admin', 'user', 'sales', 'ops'] },
  { path: '/notes', label: 'Notes', archetypes: ['admin', 'user', 'sales', 'ops'] },
  { path: '/assets', label: 'Assets', archetypes: ['admin', 'user', 'sales', 'ops'] },
  { path: '/schedule', label: 'Schedule', archetypes: ['admin', 'user', 'sales', 'ops'] },
  { path: '/crm', label: 'CRM', archetypes: ['admin', 'sales', 'user'] },
  { path: '/office', label: 'Office', archetypes: ['admin', 'user', 'ops'] },
  { path: '/management', label: 'Management', archetypes: ['admin', 'ops'] },
  { path: '/admin/console', label: 'Admin Console', archetypes: ['admin'] },
  { path: '/settings', label: 'Settings', archetypes: ['admin', 'user', 'sales', 'ops'] },
];

/**
 * @param {import('./multiUser.js').E2EUser} user
 * @returns {Array<{ path: string, label: string }>}
 */
export function routesForUser(user) {
  const perms = user.pagePermissions;
  if (Array.isArray(perms) && perms.length > 0) {
    /** @type {Map<string, { path: string, label: string }>} */
    const routes = new Map();

    for (const perm of perms) {
      const route = PERMISSION_ROUTES[perm];
      if (route) routes.set(route.path, route);
    }

    if (perms.some((perm) => CRM_PERMS.includes(perm))) {
      routes.set('/crm', { path: '/crm', label: 'CRM' });
    }
    if (perms.some((perm) => OFFICE_PERMS.includes(perm))) {
      routes.set('/office', { path: '/office', label: 'Office' });
    }
    if (perms.some((perm) => MGMT_PERMS.includes(perm))) {
      routes.set('/management', { path: '/management', label: 'Management' });
    }
    if (perms.some((perm) => ADMIN_PERMS.includes(perm))) {
      routes.set('/admin/console', { path: '/admin/console', label: 'Admin Console' });
    }

    routes.set('/settings', { path: '/settings', label: 'Settings' });
    return [...routes.values()];
  }

  return LEGACY_ROUTES_BY_ARCHETYPE
    .filter((route) => route.archetypes.includes(user.archetype))
    .map(({ path, label }) => ({ path, label }));
}
