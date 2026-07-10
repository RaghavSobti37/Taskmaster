/** ESM — keep in sync with orgPermissions.cjs */

const ADMIN_SLUG = 'admin';

export const isDepartmentAdmin = (dept) => {
  if (!dept || typeof dept !== 'object') return false;
  return dept.slug === ADMIN_SLUG || dept.permissionPreset === ADMIN_SLUG;
};

const userIdStr = (id) => (id?._id ? String(id._id) : id != null ? String(id) : '');

export const canManageOrganizationSettings = ({ user, membership, tenant } = {}) => {
  const role = membership?.role;
  if (role && ['owner', 'admin'].includes(role)) return true;
  const ownerId = tenant?.ownerId;
  const uid = userIdStr(user?._id || user);
  if (ownerId && uid && userIdStr(ownerId) === uid) return true;
  if (isDepartmentAdmin(user?.departmentId)) return true;
  return false;
};

/** Owner/admin may change plan and open Razorpay checkout. */
export const canManageBilling = (ctx) => canManageOrganizationSettings(ctx);

export const canDeleteOrganization = ({ user, membership, tenant } = {}) => {
  if (membership?.role === 'owner') return true;
  const ownerId = tenant?.ownerId;
  const uid = userIdStr(user?._id || user);
  return Boolean(ownerId && uid && userIdStr(ownerId) === uid);
};
