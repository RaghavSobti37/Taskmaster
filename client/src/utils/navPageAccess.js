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
  '/admin': 'admin_data',
  '/admin/exly-campaigns': 'admin_exly',
  '/admin/scripts': 'admin_scripts',
  '/admin/gamification': 'admin_gamification',
  '/admin/qa': 'admin_data',
};

export function filterNavGroupsForUser(groups, user, hasPageAccess) {
  return (groups || [])
    .map((group) => ({
      ...group,
      pages: (group.pages || []).filter((page) => {
        const key = NAV_PATH_ACCESS[page.path];
        return !key || hasPageAccess(user, key);
      }),
    }))
    .filter((group) => group.id !== 'admin' || group.pages.length > 0);
}
