const ADMIN_SLUG = 'admin';
const ARTIST_MANAGEMENT_SLUG = 'artist-management';
const ARTIST_BUSINESS_SLUG = 'artist-business';

const isArtistManagementDept = (dept) => {
  if (!dept || typeof dept !== 'object') return false;
  return dept.slug === ARTIST_MANAGEMENT_SLUG || dept.permissionPreset === ARTIST_MANAGEMENT_SLUG;
};

const isArtistBusinessDept = (dept) => {
  if (!dept || typeof dept !== 'object') return false;
  return dept.slug === ARTIST_BUSINESS_SLUG || dept.permissionPreset === ARTIST_BUSINESS_SLUG;
};

const applyDepartmentPageGuarantees = (pages, dept) => {
  let next = pages;
  if (isArtistManagementDept(dept) || isArtistBusinessDept(dept)) {
    if (!next.includes('artists')) next = [...next, 'artists'];
  }
  return next;
};

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
      { key: 'notes', label: 'Notes', path: '/notes' },
      { key: 'emails', label: 'Emails', path: '/emails' },
    ],
  },
  {
    id: 'office',
    label: 'Office',
    pages: [
      { key: 'equipment', label: 'Equipment', path: '/equipment' },
      { key: 'contacts', label: 'Contacts', path: '/contacts' },
      { key: 'attendance', label: 'Attendance', path: '/attendance' },
      { key: 'subscriptions', label: 'Subscriptions', path: '/subscriptions' },
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
      { key: 'announcements', label: 'Announcements', path: '/announcements' },
      { key: 'ops_logs', label: 'Ops Logs', path: '/ops-logs' },
      { key: 'artists', label: 'Artists', path: '/artists' },
    ],
  },
  {
    id: 'tools',
    label: 'App Tools',
    pages: [
      { key: 'settings', label: 'Settings', path: '/settings' },
      { key: 'office_assets', label: 'Office Assets', path: '/office-assets' },
      { key: 'features', label: 'Features', path: '/features' },
      { key: 'workflows', label: 'Workflows', path: '/workflows' },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    pages: [
      { key: 'admin_users', label: 'Users', path: '/admin/users' },
      { key: 'admin_teams', label: 'Teams', path: '/admin/teams' },
      { key: 'admin_roles', label: 'Roles', path: '/admin/roles' },
      { key: 'admin_data', label: 'Data Hub', path: '/admin' },
      { key: 'admin_artist_path', label: 'Artist Path', path: '/admin/artist-path' },
      { key: 'admin_exly', label: 'Exly Data', path: '/admin/exly-campaigns' },
      { key: 'admin_scripts', label: 'Script Runner', path: '/admin/scripts' },
      { key: 'admin_gamification', label: 'Gamification', path: '/admin/gamification' },
      { key: 'admin_project_analytics', label: 'Project Analytics', path: '/admin/project-analytics' },
      { key: 'campaigns', label: 'Campaign Details', path: '/campaign' },
    ],
  },
];

const ALL_PAGE_KEYS = PAGE_GROUPS.flatMap((g) => g.pages.map((p) => p.key));

const BASE_PAGE_KEYS = [
  'dashboard', 'calendar', 'todo', 'inbox', 'settings',
  'projects', 'assets', 'schedule', 'logs', 'notes', 'emails',
  'equipment', 'contacts', 'attendance', 'subscriptions',
];

const OPS_EXTRA_PAGES = ['finance', 'announcements', 'ops_logs', 'office_assets'];
const CREATIVE_EXTRA_PAGES = ['assets', 'features', 'workflows', 'office_assets'];

const PRESET_PAGES = {
  admin: ALL_PAGE_KEYS,
  ops: [...BASE_PAGE_KEYS, ...OPS_EXTRA_PAGES],
  operations: [...BASE_PAGE_KEYS, ...OPS_EXTRA_PAGES],
  sales: [...BASE_PAGE_KEYS, 'leads', 'followups', 'bookings'],
  'artist-management': [...BASE_PAGE_KEYS, 'artists', 'leads', 'followups', 'bookings'],
  'artist-business': [...BASE_PAGE_KEYS, 'artists', 'leads', 'followups', 'bookings'],
  creative: [...BASE_PAGE_KEYS, ...CREATIVE_EXTRA_PAGES],
  standard: BASE_PAGE_KEYS,
};

const ADMIN_PAGE_KEYS = new Set(
  PAGE_GROUPS.find((g) => g.id === 'admin')?.pages.map((p) => p.key) || []
);

const CRM_PAGE_KEYS = ['leads', 'followups', 'bookings'];
const OPS_PAGE_KEYS = ['finance', 'announcements', 'ops_logs'];

const isDepartmentAdmin = (dept) => {
  if (!dept || typeof dept !== 'object') return false;
  return dept.slug === ADMIN_SLUG || dept.permissionPreset === ADMIN_SLUG;
};

const resolveDepartmentPages = (dept) => {
  if (!dept) return BASE_PAGE_KEYS;
  if (isDepartmentAdmin(dept)) return [...ALL_PAGE_KEYS];

  const slugPreset = dept.slug === 'operations' ? 'ops' : dept.slug;
  const preset = dept.permissionPreset === 'operations' ? 'ops' : dept.permissionPreset
    || (dept.slug === ADMIN_SLUG ? ADMIN_SLUG : null)
    || (slugPreset && PRESET_PAGES[slugPreset] ? slugPreset : null);

  let pages;
  if (Array.isArray(dept.pagePermissions) && dept.pagePermissions.length > 0) {
    pages = dept.pagePermissions.filter((k) => ALL_PAGE_KEYS.includes(k));
  } else if (preset && PRESET_PAGES[preset]) {
    pages = [...PRESET_PAGES[preset]];
  } else if (dept.slug && PRESET_PAGES[dept.slug]) {
    pages = [...PRESET_PAGES[dept.slug]];
  } else {
    pages = [...BASE_PAGE_KEYS];
  }

  return applyDepartmentPageGuarantees(pages, dept);
};

const getUserPagePermissions = (user) => {
  if (isDepartmentAdmin(user?.departmentId)) return [...ALL_PAGE_KEYS];
  if (Array.isArray(user?.pagePermissions) && user.pagePermissions.length > 0) {
    return user.pagePermissions.filter((k) => ALL_PAGE_KEYS.includes(k));
  }
  return resolveDepartmentPages(user?.departmentId);
};

const hasPageAccess = (user, pageKey) => {
  if (!pageKey) return true;
  // Mail hub + campaign detail: any authenticated user
  if ((pageKey === 'emails' || pageKey === 'campaigns') && user) return true;
  if (pageKey === 'admin_artist_path') {
    if (isDepartmentAdmin(user?.departmentId)) return true;
    const perms = getUserPagePermissions(user);
    return perms.includes('admin_artist_path') || perms.includes('admin_data');
  }
  if (isDepartmentAdmin(user?.departmentId)) return ALL_PAGE_KEYS.includes(pageKey);
  return getUserPagePermissions(user).includes(pageKey);
};

const hasAnyPageAccess = (user, pageKeys) => pageKeys.some((k) => hasPageAccess(user, k));

const isAdminUser = (user) => isDepartmentAdmin(user?.departmentId);

const hasCrmPageAccess = (user) => isAdminUser(user) || hasAnyPageAccess(user, CRM_PAGE_KEYS);

const isSalesUser = (user) => hasCrmPageAccess(user);

const isOpsUser = (user) => isAdminUser(user) || hasAnyPageAccess(user, OPS_PAGE_KEYS);

const isArtistManagerUser = (user) => isAdminUser(user) || hasPageAccess(user, 'artists');

const isArtistBusinessUser = (user) => isAdminUser(user) || isArtistBusinessDept(user?.departmentId);

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
  isArtistBusinessUser,
  hasCrmPageAccess,
  CRM_PAGE_KEYS,
  OPS_PAGE_KEYS,
  validatePagePermissions,
  departmentHasAdminAccess,
};
