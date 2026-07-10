#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Department = require('../models/Department');
const PlatformSettings = require('../models/PlatformSettings');

const BYPASS = { bypassTenant: true };
const useProd = process.argv.includes('--prod');
const targetEmail = String(process.env.PLATFORM_OWNER_EMAIL || '').trim().toLowerCase();

async function main() {
  const uri = useProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI;
  if (!uri) throw new Error('Mongo URI missing');
  await mongoose.connect(uri);

  const tenant = await Tenant.findOne({ slug: 'tsc' }).setOptions(BYPASS);
  if (!tenant) throw new Error('tsc tenant missing');

  const adminDept = await Department.findOne({ slug: 'admin', tenantId: tenant._id }).setOptions(BYPASS);
  const unassignedFilter = {
    tenantId: tenant._id,
    $or: [{ departmentId: null }, { departmentId: { $exists: false } }],
  };
  const unassigned = await User.find(unassignedFilter).setOptions(BYPASS).select('email name clerkId _id').lean();
  const oldUser = await User.findById('6a03b8ac51c059f0ec56d385').setOptions(BYPASS).select('email name departmentId').lean();
  const settings = await PlatformSettings.findOne().setOptions(BYPASS).lean();
  const ownerUser = targetEmail
    ? await User.findOne({ email: targetEmail }).setOptions(BYPASS).lean()
    : null;

  console.log(JSON.stringify({
    label: useProd ? 'PROD' : 'LOCAL',
    tenantId: String(tenant._id),
    tenantOwnerId: String(tenant.ownerId || ''),
    adminDeptId: String(adminDept?._id || ''),
    rootAdminUserIds: settings?.rootAdminUserIds,
    platformOwnerUserId: settings?.platformOwnerUserId,
    ownerUser: ownerUser ? { _id: String(ownerUser._id), departmentId: ownerUser.departmentId, clerkId: ownerUser.clerkId } : null,
    oldUser,
    unassignedCount: unassigned.length,
    unassigned,
  }, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
