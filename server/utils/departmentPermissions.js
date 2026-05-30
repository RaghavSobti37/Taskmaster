const {
  isAdminUser,
  isSalesUser,
  isOpsUser,
  isArtistManagerUser,
  hasPageAccess,
  hasAnyPageAccess,
  getUserPagePermissions,
  resolveDepartmentPages,
  PRESET_PAGES,
  ALL_PAGE_KEYS,
} = require('./pagePermissions');

const ADMIN_SLUG = 'admin';
const SALES_SLUG = 'sales';
const OPS_SLUG = 'operations';
const ARTIST_SLUG = 'artist-management';
const STANDARD_PRESET = 'standard';

const PRESET_VALUES = new Set([ADMIN_SLUG, SALES_SLUG, OPS_SLUG, ARTIST_SLUG, STANDARD_PRESET]);

const getDepartmentSlug = (user) => {
  const dept = user?.departmentId;
  if (!dept) return null;
  if (typeof dept === 'object' && dept.slug) return dept.slug;
  return null;
};

const getPermissionPreset = (user) => {
  const dept = user?.departmentId;
  if (!dept || typeof dept !== 'object') return null;
  if (dept.permissionPreset) return dept.permissionPreset;
  if (dept.slug && PRESET_VALUES.has(dept.slug)) return dept.slug;
  return dept.slug || null;
};

/** Legacy role string → department slug (migration only). */
const ROLE_TO_SLUG = {
  admin: ADMIN_SLUG,
  administrator: ADMIN_SLUG,
  sales: SALES_SLUG,
  artist_management: ARTIST_SLUG,
  'artist-management': ARTIST_SLUG,
  operations: OPS_SLUG,
  ops: OPS_SLUG,
  Operations: OPS_SLUG,
  editor: 'editor',
  videographer: 'videographer',
  cg_artist: 'cg-artist',
  'cg-artist': 'cg-artist',
  user: null,
};

module.exports = {
  ADMIN_SLUG,
  SALES_SLUG,
  OPS_SLUG,
  ARTIST_SLUG,
  STANDARD_PRESET,
  PRESET_VALUES,
  ROLE_TO_SLUG,
  getDepartmentSlug,
  getPermissionPreset,
  isAdminUser,
  isSalesUser,
  isOpsUser,
  isArtistManagerUser,
  hasPageAccess,
  hasAnyPageAccess,
  getUserPagePermissions,
  resolveDepartmentPages,
  PRESET_PAGES,
  ALL_PAGE_KEYS,
};
