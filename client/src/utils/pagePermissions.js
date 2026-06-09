import { HUB_CONFIG } from './navbarConfig';

export const PAGE_GROUPS = [
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
    id: 'admin',
    label: 'Admin',
    pages: [
      { key: 'admin_users', label: 'Users', path: '/admin/users' },
      { key: 'admin_teams', label: 'Teams', path: '/admin/teams' },
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

export const ALL_PAGE_KEYS = PAGE_GROUPS.flatMap((g) => g.pages.map((p) => p.key));

export const BASE_PAGE_KEYS = [
  'dashboard', 'calendar', 'todo', 'inbox',
  'projects', 'assets', 'schedule', 'logs', 'notes', 'emails',
  'equipment', 'contacts', 'attendance', 'subscriptions',
];

export const PRESET_PAGES = {
  admin: ALL_PAGE_KEYS,
  operations: [...BASE_PAGE_KEYS, 'finance', 'announcements', 'ops_logs'],
  sales: [...BASE_PAGE_KEYS, 'leads', 'followups', 'bookings'],
  'artist-management': [...BASE_PAGE_KEYS, 'artists', 'leads', 'followups', 'bookings'],
  standard: BASE_PAGE_KEYS,
};

const ADMIN_PAGE_KEYS = new Set(
  PAGE_GROUPS.find((g) => g.id === 'admin')?.pages.map((p) => p.key) || []
);

const CRM_PAGE_KEYS = ['leads', 'followups', 'bookings'];
const OPS_PAGE_KEYS = ['finance', 'announcements', 'ops_logs'];

export const PERMISSION_PRESET_OPTIONS = [
  { value: 'admin', label: 'Admin (all pages)', description: 'Full access to every page' },
  { value: 'operations', label: 'Operations', description: 'Base workspace + finance, announcements, ops logs' },
  { value: 'sales', label: 'Sales', description: 'Base workspace + CRM pages' },
  { value: 'artist-management', label: 'Artist Management', description: 'Base workspace + artists + artist CRM (press, events, bookings)' },
  { value: 'standard', label: 'Standard', description: 'Dashboard, tasks, projects, and office tools only' },
];

const ADMIN_SLUG = 'admin';
const ARTIST_MANAGEMENT_SLUG = 'artist-management';

function isArtistManagementDept(dept) {
  if (!dept || typeof dept !== 'object') return false;
  return dept.slug === ARTIST_MANAGEMENT_SLUG || dept.permissionPreset === ARTIST_MANAGEMENT_SLUG;
}

function applyDepartmentPageGuarantees(pages, dept) {
  if (!isArtistManagementDept(dept)) return pages;
  if (pages.includes('artists')) return pages;
  return [...pages, 'artists'];
}

export function isDepartmentAdmin(dept) {
  if (!dept || typeof dept !== 'object') return false;
  return dept.slug === ADMIN_SLUG || dept.permissionPreset === ADMIN_SLUG;
}

export function resolveDepartmentPages(dept) {
  if (!dept) return BASE_PAGE_KEYS;
  if (isDepartmentAdmin(dept)) return [...ALL_PAGE_KEYS];

  const preset = dept.permissionPreset
    || (dept.slug === ADMIN_SLUG ? ADMIN_SLUG : null)
    || (dept.slug && PRESET_PAGES[dept.slug] ? dept.slug : null);

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
}

export function getUserPagePermissions(user) {
  return resolveDepartmentPages(user?.departmentId);
}

export function hasPageAccess(user, pageKey) {
  if (!pageKey) return true;
  if (pageKey === 'emails' && user) return true;
  if (pageKey === 'admin_artist_path') {
    if (isDepartmentAdmin(user?.departmentId)) return true;
    const perms = getUserPagePermissions(user);
    return perms.includes('admin_artist_path') || perms.includes('admin_data');
  }
  if (isDepartmentAdmin(user?.departmentId)) return ALL_PAGE_KEYS.includes(pageKey);
  return getUserPagePermissions(user).includes(pageKey);
}

export function hasAnyPageAccess(user, pageKeys) {
  return pageKeys.some((k) => hasPageAccess(user, k));
}

export function isAdminUser(user) {
  return isDepartmentAdmin(user?.departmentId);
}

export function isSalesUser(user) {
  return isAdminUser(user) || hasAnyPageAccess(user, CRM_PAGE_KEYS);
}

export function isOpsUser(user) {
  return isAdminUser(user) || hasAnyPageAccess(user, OPS_PAGE_KEYS);
}

export function isArtistManagerUser(user) {
  return isAdminUser(user) || hasPageAccess(user, 'artists');
}

export function canAccessOrgAccounts(user) {
  return isArtistManagerUser(user) || isOpsUser(user);
}

export function groupHasVisiblePages(user, pageKeys) {
  return pageKeys.some((k) => hasPageAccess(user, k));
}

function hasHubAccess(user, hubPath) {
  const hub = HUB_CONFIG[hubPath];
  if (!hub) return false;
  return hasAnyPageAccess(user, hub.childKeys);
}
