const ADMIN_SLUG = 'admin';
const SALES_SLUG = 'sales';
const OPS_SLUG = 'operations';
const ARTIST_SLUG = 'artist-management';

const getDepartmentSlug = (user) => {
  const dept = user?.departmentId;
  if (!dept) return null;
  if (typeof dept === 'object' && dept.slug) return dept.slug;
  return null;
};

const isAdminUser = (user) => getDepartmentSlug(user) === ADMIN_SLUG;

const isSalesUser = (user) => {
  const slug = getDepartmentSlug(user);
  return slug === SALES_SLUG || slug === ADMIN_SLUG;
};

const isOpsUser = (user) => {
  const slug = getDepartmentSlug(user);
  return slug === OPS_SLUG || slug === ADMIN_SLUG;
};

const isArtistManagerUser = (user) => {
  const slug = getDepartmentSlug(user);
  return slug === ARTIST_SLUG || slug === ADMIN_SLUG;
};

/** Legacy role string → department slug (migration only). */
const ROLE_TO_SLUG = {
  admin: ADMIN_SLUG,
  sales: SALES_SLUG,
  artist_management: ARTIST_SLUG,
  operations: OPS_SLUG,
  ops: OPS_SLUG,
  Operations: OPS_SLUG,
  user: null,
};

module.exports = {
  ADMIN_SLUG,
  SALES_SLUG,
  OPS_SLUG,
  ARTIST_SLUG,
  ROLE_TO_SLUG,
  getDepartmentSlug,
  isAdminUser,
  isSalesUser,
  isOpsUser,
  isArtistManagerUser,
};
