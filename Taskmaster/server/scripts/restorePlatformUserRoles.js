/**
 * Restore TSC platform admin department + PlatformSettings owner ids after Clerk re-provision.
 *
 *   node server/scripts/restorePlatformUserRoles.js
 *   node server/scripts/restorePlatformUserRoles.js --prod --yes
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Department = require('../models/Department');
const PlatformSettings = require('../models/PlatformSettings');
const TenantMembership = require('../models/TenantMembership');
const {
  platformAdminEmails,
  platformOwnerEmail,
  resolvePlatformTenant,
  resolveAdminDepartment,
} = require('../utils/reconcilePlatformUserDepartment');

const BYPASS = { bypassTenant: true };
const useProd = process.argv.includes('--prod');
const dryRun = !process.argv.includes('--yes');

async function ensureMembership(userId, tenantId, role = 'owner') {
  const existing = await TenantMembership.findOne({ userId, tenantId }).setOptions(BYPASS);
  if (existing) {
    if (existing.role !== role && !dryRun) {
      existing.role = role;
      existing.status = 'active';
      existing.needsRoleReview = false;
      await existing.save();
    }
    return existing;
  }
  if (dryRun) return null;
  return TenantMembership.create({
    userId,
    tenantId,
    role,
    status: 'active',
    needsRoleReview: false,
  });
}

async function main() {
  const uri = useProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI;
  if (!uri) throw new Error(useProd ? 'MONGODB_URI_PROD missing' : 'MONGODB_URI missing');

  await mongoose.connect(uri);
  const label = useProd ? 'PROD' : 'LOCAL';
  console.log(`[${label}] ${dryRun ? 'DRY RUN' : 'EXECUTE'} — restore platform user roles`);

  const tenant = await resolvePlatformTenant();
  if (!tenant) throw new Error('Platform tenant not found');

  const adminDept = await resolveAdminDepartment(tenant._id);
  if (!adminDept) throw new Error('Admin department not found for platform tenant');

  const emails = platformAdminEmails();
  const candidates = await User.find({
    tenantId: tenant._id,
    $or: [
      { email: { $in: emails } },
      { departmentId: null },
      { departmentId: { $exists: false } },
    ],
  }).setOptions(BYPASS).select('email name departmentId clerkId _id').lean();

  const toFix = candidates.filter((u) =>
    emails.includes(String(u.email || '').toLowerCase()),
  );

  const ownerEmail = platformOwnerEmail();
  const primaryOwner = ownerEmail
    ? await User.findOne({
      email: ownerEmail,
      tenantId: tenant._id,
    }).setOptions(BYPASS).select('_id email name').lean()
    : null;

  console.log(`Tenant: ${tenant.name} (${tenant._id})`);
  console.log(`Admin dept: ${adminDept.name} (${adminDept._id})`);
  console.log(`Users to assign admin dept: ${toFix.length}`);
  toFix.forEach((u) => console.log(`  - ${u.email} (${u._id})`));

  if (primaryOwner) {
    console.log(`Platform owner: ${primaryOwner.email} (${primaryOwner._id})`);
  }

  if (dryRun) {
    await mongoose.disconnect();
    return;
  }

  for (const row of toFix) {
    await User.updateOne(
      { _id: row._id },
      { $set: { departmentId: adminDept._id, tenantId: tenant._id } },
    ).setOptions(BYPASS);
    if (primaryOwner && String(row._id) === String(primaryOwner._id)) {
      await ensureMembership(row._id, tenant._id, 'owner');
    }
  }

  if (primaryOwner) {
    tenant.ownerId = primaryOwner._id;
    await tenant.save();
    await ensureMembership(primaryOwner._id, tenant._id, 'owner');

    let settings = await PlatformSettings.findOne({ singletonKey: 'global' }).setOptions(BYPASS);
    if (!settings) {
      settings = await PlatformSettings.create({ singletonKey: 'global' });
    }
    const rootIds = new Set((settings.rootAdminUserIds || []).map(String));
    rootIds.add(String(primaryOwner._id));
    settings.rootAdminUserIds = [...rootIds];
    settings.platformOwnerUserId = primaryOwner._id;
    await settings.save();
  }

  console.log('Done.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
