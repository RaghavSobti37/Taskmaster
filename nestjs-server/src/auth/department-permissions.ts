import { AuthUser, DepartmentRef } from './auth.types';

const ADMIN_SLUG = 'admin';
const OPS_PAGE_KEYS = new Set(['finance', 'announcements', 'ops_logs']);

const isDepartmentAdmin = (dept?: DepartmentRef | null) => {
  if (!dept) return false;
  return dept.slug === ADMIN_SLUG || dept.permissionPreset === ADMIN_SLUG;
};

const getUserPagePermissions = (user: AuthUser): string[] => {
  const dept = user.departmentId;
  if (!dept) return [];
  if (isDepartmentAdmin(dept)) return ['*'];
  if (Array.isArray(dept.pagePermissions) && dept.pagePermissions.length > 0) {
    return dept.pagePermissions;
  }
  const preset = dept.permissionPreset || dept.slug;
  if (preset === 'operations') {
    return [
      'dashboard', 'calendar', 'todo', 'inbox', 'projects', 'assets', 'schedule',
      'logs', 'notes', 'emails', 'equipment', 'contacts', 'attendance', 'subscriptions',
      'finance', 'announcements', 'ops_logs',
    ];
  }
  return [];
};

const hasAnyPageAccess = (user: AuthUser, pageKeys: Iterable<string>) => {
  const pages = getUserPagePermissions(user);
  if (pages.includes('*')) return true;
  return [...pageKeys].some((key) => pages.includes(key));
};

export const isAdminUser = (user: AuthUser) => isDepartmentAdmin(user.departmentId);

export const isOpsUser = (user: AuthUser) =>
  isAdminUser(user) || hasAnyPageAccess(user, OPS_PAGE_KEYS);
