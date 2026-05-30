export const ADMIN_SLUG = 'admin';
export const SALES_SLUG = 'sales';
export const OPS_SLUG = 'operations';
export const ARTIST_SLUG = 'artist-management';
export const STANDARD_PRESET = 'standard';

export {
  PAGE_GROUPS,
  ALL_PAGE_KEYS,
  BASE_PAGE_KEYS,
  PRESET_PAGES,
  PERMISSION_PRESET_OPTIONS,
  isDepartmentAdmin,
  resolveDepartmentPages,
  getUserPagePermissions,
  hasPageAccess,
  hasAnyPageAccess,
  isAdminUser,
  isSalesUser,
  isOpsUser,
  isArtistManagerUser,
  groupHasVisiblePages,
} from './pagePermissions';

export function getDepartmentSlug(user) {
  const dept = user?.departmentId;
  if (!dept) return null;
  if (typeof dept === 'object' && dept.slug) return dept.slug;
  return null;
}

export function getDepartmentName(user) {
  const dept = user?.departmentId;
  if (!dept) return 'Unassigned';
  if (typeof dept === 'object' && dept.name) return dept.name;
  return 'Unassigned';
}

export function getPermissionPreset(user) {
  const dept = user?.departmentId;
  if (!dept || typeof dept !== 'object') return null;
  if (dept.permissionPreset) return dept.permissionPreset;
  return null;
}

/** @deprecated use OPS_SLUG checks via isOpsUser */
export const OPS_ROLES = new Set([ADMIN_SLUG, OPS_SLUG]);
