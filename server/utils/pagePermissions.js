const ADMIN_SLUG = 'admin';

const PAGE_GROUPS = [
  {
    id: 'platform',
    label: 'Platform',
    pages: [
      { key: 'dashboard', label: 'Dashboard', path: '/dashboard' },
      { key: 'calendar', label: 'Calendar', path: '/calendar' },
      { key: 'todo', label: 'Todo', path: '/todo' },
      { key: 'inbox', label: 'Inbox', path: '/inbox' },
    ],
  },
  {
    id: 'workspace',
    label: 'Workspace',
    pages: [
      { key: 'projects', label: 'Projects', path: '/projects' },
      { key: 'assets', label: 'Assets', path: '/assets' },
      { key: 'schedule', label: 'Schedule', path: '/schedule' },
      { key: 'logs', label: 'Daily Logs', path: '/logs' },
      { key: 'emails', label: 'Emails', path: '/workspace/emails' },
    ],
  },
  {
    id: 'office',
    label: 'Office',
    pages: [
      { key: 'equipment', label: 'Equipment', path: '/management/equipment' },
      { key: 'contacts', label: 'Contacts', path: '/management/contacts' },
      { key: 'attendance', label: 'Attendance', path: '/attendance' },
    ],
  },
  {
    id: 'crm',
    label: 'CRM',
    pages: [
      { key: 'leads', label: 'Leads', path: '/leads' },
      { key: 'followups', label: 'Followups', path: '/followups' },
      { key: 'bookings', label: 'Bookings', path: '/bookings' },
    ],
  },
  {
    id: 'management',
    label: 'Management',
    pages: [
      { key: 'finance', label: 'Finance', path: '/finance' },
      { key: 'announcements', label: 'Announcements', path: '/management/announcements' },
      { key: 'ops_logs', label: 'Ops Logs', path: '/management/ops-logs' },
      { key: 'artists', label: 'Artists', path: '/artists' },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    pages: [
      { key: 'admin_users', label: 'Users & Teams', path: '/admin/users' },
      { key: 'admin_data', label: 'All Data', path: '/admin' },
      { key: 'admin_exly', label: 'Exly Data', path: '/admin/exly-campaigns' },
      { key: 'admin_scripts', label: 'Script Runner', path: '/admin/scripts' },
      { key: 'admin_gamification', label: 'Gamification', path: '/admin/gamification' },
      { key: 'campaigns', label: 'Campaign Details', path: '/campaign' },
    ],
  },
];

const ALL_PAGE_KEYS = PAGE_GROUPS.flatMap((g) => g.pages.map((p) => p.key));

const BASE_PAGE_KEYS = [
  'dashboard', 'calendar', 'todo', 'inbox',
  'projects', 'assets', 'schedule', 'logs',
  'equipment', 'contacts', 'attendance',
];

const PRESET_PAGES = {
  admin: ALL_PAGE_KEYS,
  operations: [...BASE_PAGE_KEYS, 'finance', 'announcements', 'ops_logs'],
  sales: [...BASE_PAGE_KEYS, 'leads', 'followups', 'bookings'],
  'artist-management': [...BASE_PAGE_KEYS, 'artists'],
  standard: BASE_PAGE_KEYS,
};

const ADMIN_PAGE_KEYS = new Set(
  PAGE_GROUPS.find((g) => g.id === 'admin')?.pages.map((p) => p.key) || []
);

const CRM_PAGE_KEYS = new Set(['leads', 'followups', 'bookings']);
const OPS_PAGE_KEYS = new Set(['finance', 'announcements', 'ops_logs']);

const isDepartmentAdmin = (dept) => {
  if (!dept || typeof dept !== 'object') return false;
  return dept.slug === ADMIN_SLUG || dept.permissionPreset === ADMIN_SLUG;
};

const resolveDepartmentPages = (dept) => {
  if (!dept) return BASE_PAGE_KEYS;
  if (isDepartmentAdmin(dept)) return [...ALL_PAGE_KEYS];
  if (Array.isArray(dept.pagePermissions) && dept.pagePermissions.length > 0) {
    return dept.pagePermissions.filter((k) => ALL_PAGE_KEYS.includes(k));
  }
  const preset = dept.permissionPreset || (dept.slug === ADMIN_SLUG ? ADMIN_SLUG : null);
  if (preset && PRESET_PAGES[preset]) return [...PRESET_PAGES[preset]];
  if (dept.slug && PRESET_PAGES[dept.slug]) return [...PRESET_PAGES[dept.slug]];
  return BASE_PAGE_KEYS;
};

const getUserPagePermissions = (user) => resolveDepartmentPages(user?.departmentId);

const hasPageAccess = (user, pageKey) => {
  if (!pageKey) return true;
  if (isDepartmentAdmin(user?.departmentId)) return ALL_PAGE_KEYS.includes(pageKey);
  return getUserPagePermissions(user).includes(pageKey);
};

const hasAnyPageAccess = (user, pageKeys) => pageKeys.some((k) => hasPageAccess(user, k));

const isAdminUser = (user) => isDepartmentAdmin(user?.departmentId);

const isSalesUser = (user) => isAdminUser(user) || hasAnyPageAccess(user, [...CRM_PAGE_KEYS]);

const isOpsUser = (user) => isAdminUser(user) || hasAnyPageAccess(user, [...OPS_PAGE_KEYS]);

const isArtistManagerUser = (user) => isAdminUser(user) || hasPageAccess(user, 'artists');

const validatePagePermissions = (pages) => {
  if (!Array.isArray(pages)) return { valid: false, error: 'pagePermissions must be an array' };
  const invalid = pages.filter((k) => !ALL_PAGE_KEYS.includes(k));
  if (invalid.length) return { valid: false, error: `Invalid page keys: ${invalid.join(', ')}` };
  return { valid: true, pages: [...new Set(pages)] };
};

const departmentHasAdminAccess = (dept) => isDepartmentAdmin(dept);

module.exports = {
  PAGE_GROUPS,
  ALL_PAGE_KEYS,
  BASE_PAGE_KEYS,
  PRESET_PAGES,
  ADMIN_PAGE_KEYS,
  isDepartmentAdmin,
  resolveDepartmentPages,
  getUserPagePermissions,
  hasPageAccess,
  hasAnyPageAccess,
  isAdminUser,
  isSalesUser,
  isOpsUser,
  isArtistManagerUser,
  validatePagePermissions,
  departmentHasAdminAccess,
};
