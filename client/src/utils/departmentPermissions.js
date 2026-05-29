export const ADMIN_SLUG = 'admin';
export const SALES_SLUG = 'sales';
export const OPS_SLUG = 'operations';
export const ARTIST_SLUG = 'artist-management';

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

export function isAdminUser(user) {
  return getDepartmentSlug(user) === ADMIN_SLUG;
}

export function isSalesUser(user) {
  const slug = getDepartmentSlug(user);
  return slug === SALES_SLUG || slug === ADMIN_SLUG;
}

export function isOpsUser(user) {
  const slug = getDepartmentSlug(user);
  return slug === OPS_SLUG || slug === ADMIN_SLUG;
}

export function isArtistManagerUser(user) {
  const slug = getDepartmentSlug(user);
  return slug === ARTIST_SLUG || slug === ADMIN_SLUG;
}

/** @deprecated use OPS_SLUG checks via isOpsUser */
export const OPS_ROLES = new Set([ADMIN_SLUG, OPS_SLUG]);
