const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Department = require('../models/Department');
const PlatformSettings = require('../models/PlatformSettings');
const { invalidateAuthUserCache } = require('./authUserLookup');

const BYPASS = { bypassTenant: true };

const DEFAULT_PLATFORM_ADMIN_EMAILS = String(process.env.PLATFORM_ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function platformOwnerEmail() {
  return String(process.env.PLATFORM_OWNER_EMAIL || '').trim().toLowerCase();
}

function platformAdminEmails() {
  const extra = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const set = new Set(DEFAULT_PLATFORM_ADMIN_EMAILS.map((e) => e.toLowerCase()));
  const ownerEmail = platformOwnerEmail();
  if (ownerEmail) set.add(ownerEmail);
  if (extra) set.add(extra);
  return [...set];
}

async function resolvePlatformTenant(slug = null) {
  const platformSlug = String(slug || process.env.PLATFORM_TENANT_SLUG || 'tsc').trim();
  return Tenant.findOne({ slug: platformSlug }).setOptions(BYPASS).select('_id slug ownerId name');
}

async function resolveAdminDepartment(tenantId) {
  return Department.findOne({ slug: 'admin', tenantId }).setOptions(BYPASS).select('_id name slug');
}

/**
 * Assign admin department to platform owner / root admins missing departmentId.
 * Safe to run on every authenticated request (no-op when already assigned).
 */
async function reconcilePlatformUserDepartment(user) {
  if (!user?._id) return { changed: false };
  if (user.departmentId && (user.departmentId.slug || user.departmentId._id)) {
    return { changed: false };
  }

  const tenant = await resolvePlatformTenant();
  if (!tenant) return { changed: false };

  const userTenantId = String(user.tenantId || '');
  if (userTenantId && userTenantId !== String(tenant._id)) {
    return { changed: false };
  }

  const settings = await PlatformSettings.findOne({ singletonKey: 'global' }).setOptions(BYPASS).lean();
  const rootIds = (settings?.rootAdminUserIds || []).map(String);
  const ownerId = settings?.platformOwnerUserId ? String(settings.platformOwnerUserId) : null;
  const tenantOwnerId = tenant.ownerId ? String(tenant.ownerId) : null;
  const uid = String(user._id);
  const email = String(user.email || '').toLowerCase();

  const isPlatformAdmin =
    platformAdminEmails().includes(email)
    || rootIds.includes(uid)
    || (ownerId && ownerId === uid)
    || (tenantOwnerId && tenantOwnerId === uid);

  if (!isPlatformAdmin) return { changed: false };

  const adminDept = await resolveAdminDepartment(tenant._id);
  if (!adminDept) return { changed: false };

  await User.updateOne(
    { _id: user._id },
    { $set: { departmentId: adminDept._id, tenantId: tenant._id } },
  ).setOptions(BYPASS);

  if (!tenant.ownerId && platformOwnerEmail() && email === platformOwnerEmail()) {
    tenant.ownerId = user._id;
    await tenant.save();
  }

  user.departmentId = adminDept;
  user.tenantId = tenant._id;
  await invalidateAuthUserCache(user._id);
  return { changed: true, departmentId: adminDept._id };
}

module.exports = {
  reconcilePlatformUserDepartment,
  platformAdminEmails,
  platformOwnerEmail,
  resolvePlatformTenant,
  resolveAdminDepartment,
};
