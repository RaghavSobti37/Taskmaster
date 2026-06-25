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
      { key: 'admin_users', label: 'Platform settings', path: '/admin/platform-settings' },
      { key: 'admin_teams', label: 'Teams', path: '/admin/teams' },
      { key: 'admin_roles', label: 'Roles', path: '/admin/roles' },
      { key: 'admin_data', label: 'Data Hub', path: '/admin' },
      { key: 'admin_ops_hub', label: 'Ops Hub', path: '/admin/ops-hub' },
      { key: 'ops_hub_academy', label: 'Ops Hub — Academy', path: '/admin/ops-hub' },
      { key: 'ops_hub_media', label: 'Ops Hub — Media', path: '/admin/ops-hub' },
      { key: 'ops_hub_show_booking', label: 'Ops Hub — Show Booking', path: '/admin/ops-hub' },
      { key: 'ops_hub_influencers', label: 'Ops Hub — Influencers', path: '/admin/ops-hub' },
      { key: 'admin_data', label: 'Media List', path: '/admin/media-list' },
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
  'dashboard', 'calendar', 'todo', 'inbox', 'settings',
  'projects', 'assets', 'schedule', 'logs', 'notes', 'emails',
  'equipment', 'contacts', 'attendance', 'subscriptions',
];

const OPS_EXTRA_PAGES = ['finance', 'announcements', 'ops_logs', 'office_assets'];
const CREATIVE_EXTRA_PAGES = ['assets', 'features', 'workflows', 'office_assets'];

export const PRESET_PAGES = {
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

export const CRM_PAGE_KEYS = ['leads', 'followups', 'bookings'];
const OPS_PAGE_KEYS = ['finance', 'announcements', 'ops_logs'];

export const PERMISSION_PRESET_OPTIONS = [
  { value: 'admin', label: 'Admin (all pages)', description: 'Full access to every page' },
  { value: 'ops', label: 'Operations', description: 'Base workspace + finance, announcements, ops logs, office assets' },
  { value: 'sales', label: 'Sales', description: 'Base workspace + CRM pages' },
  { value: 'artist-management', label: 'Artist Management', description: 'Base workspace + artists + artist CRM' },
  { value: 'artist-business', label: 'Artist Business', description: 'Artist bookings CRM + TSC Films project access' },
  { value: 'creative', label: 'Creative', description: 'Base workspace + assets, features, workflows, office assets' },
  { value: 'standard', label: 'Standard', description: 'Dashboard, tasks, projects, and office tools only' },
];

const ADMIN_SLUG = 'admin';
const ARTIST_MANAGEMENT_SLUG = 'artist-management';
const ARTIST_BUSINESS_SLUG = 'artist-business';

function isArtistManagementDept(dept) {
  if (!dept || typeof dept !== 'object') return false;
  return dept.slug === ARTIST_MANAGEMENT_SLUG || dept.permissionPreset === ARTIST_MANAGEMENT_SLUG;
}

function isArtistBusinessDept(dept) {
  if (!dept || typeof dept !== 'object') return false;
  return dept.slug === ARTIST_BUSINESS_SLUG || dept.permissionPreset === ARTIST_BUSINESS_SLUG;
}

function applyDepartmentPageGuarantees(pages, dept) {
  let next = pages;
  if (isArtistManagementDept(dept) || isArtistBusinessDept(dept)) {
    if (!next.includes('artists')) next = [...next, 'artists'];
  }
  return next;
}

export function isDepartmentAdmin(dept) {
  if (!dept || typeof dept !== 'object') return false;
  return dept.slug === ADMIN_SLUG || dept.permissionPreset === ADMIN_SLUG;
}

export function resolveDepartmentPages(dept) {
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
}

export function getUserPagePermissions(user) {
  if (isDepartmentAdmin(user?.departmentId)) return [...ALL_PAGE_KEYS];
  if (Array.isArray(user?.pagePermissions) && user.pagePermissions.length > 0) {
    return user.pagePermissions.filter((k) => ALL_PAGE_KEYS.includes(k));
  }
  return resolveDepartmentPages(user?.departmentId);
}

export function hasPageAccess(user, pageKey) {
  if (!pageKey) return true;
  // Mail hub + campaign detail: any authenticated user
  if ((pageKey === 'emails' || pageKey === 'campaigns') && user) return true;
  if (pageKey === 'admin_artist_path') {
    if (isDepartmentAdmin(user?.departmentId)) return true;
    const perms = getUserPagePermissions(user);
    return perms.includes('admin_artist_path') || perms.includes('admin_data');
  }
  if (pageKey === 'admin_ops_hub') {
    if (isDepartmentAdmin(user?.departmentId)) return true;
    const perms = getUserPagePermissions(user);
    return perms.includes('admin_ops_hub')
      || perms.includes('ops_hub_academy')
      || perms.includes('ops_hub_media')
      || perms.includes('ops_hub_show_booking')
      || perms.includes('ops_hub_influencers');
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

export function hasCrmPageAccess(user) {
  return isAdminUser(user) || hasAnyPageAccess(user, CRM_PAGE_KEYS);
}

export function isSalesUser(user) {
  return hasCrmPageAccess(user);
}

export function isOpsUser(user) {
  return isAdminUser(user) || hasAnyPageAccess(user, OPS_PAGE_KEYS);
}

export function isArtistManagerUser(user) {
  return isAdminUser(user) || hasPageAccess(user, 'artists');
}

export function isArtistBusinessUser(user) {
  if (isAdminUser(user)) return true;
  const dept = user?.departmentId;
  return isArtistBusinessDept(dept);
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
