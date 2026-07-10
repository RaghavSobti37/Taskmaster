#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const TaskAssignment = require('../domains/tasks/models/TaskAssignment');
const Tenant = require('../models/Tenant');
const User = require('../models/User');

const BYPASS = { bypassTenant: true };
const LEGACY_USER_ID = '6a03b8ac51c059f0ec56d385';
const TARGET_EMAIL = String(process.env.PLATFORM_OWNER_EMAIL || '').trim().toLowerCase();
const runProd = process.argv.includes('--prod');
const dryRun = !process.argv.includes('--yes');

async function repair(uri, label) {
  await mongoose.connect(uri);
  const tenant = await Tenant.findOne({ slug: 'tsc' }).setOptions(BYPASS).lean();
  if (!TARGET_EMAIL) throw new Error('PLATFORM_OWNER_EMAIL missing');
  const targetUser = await User.findOne({ email: TARGET_EMAIL, tenantId: tenant._id }).setOptions(BYPASS).lean();
  if (!targetUser) throw new Error(`[${label}] target user missing: ${TARGET_EMAIL}`);

  const legacyAssignments = await TaskAssignment.find({
    tenantId: tenant._id,
    userId: new mongoose.Types.ObjectId(LEGACY_USER_ID),
  }).setOptions(BYPASS).lean();

  let moved = 0;
  let removedDupes = 0;
  for (const row of legacyAssignments) {
    const exists = await TaskAssignment.findOne({
      tenantId: tenant._id,
      taskId: row.taskId,
      userId: targetUser._id,
    }).setOptions(BYPASS).lean();

    if (dryRun) {
      if (exists) removedDupes += 1;
      else moved += 1;
      continue;
    }

    if (exists) {
      await TaskAssignment.deleteOne({ _id: row._id }).setOptions(BYPASS);
      removedDupes += 1;
    } else {
      await TaskAssignment.updateOne(
        { _id: row._id },
        { $set: { userId: targetUser._id } },
      ).setOptions(BYPASS);
      moved += 1;
    }
  }

  const finalCount = await TaskAssignment.countDocuments({
    tenantId: tenant._id,
    userId: targetUser._id,
  }).setOptions(BYPASS);

  console.log(JSON.stringify({
    label,
    dryRun,
    tenantId: String(tenant._id),
    targetUserId: String(targetUser._id),
    legacyAssignments: legacyAssignments.length,
    moved,
    removedDupes,
    finalTargetAssignmentCount: finalCount,
  }, null, 2));

  await mongoose.disconnect();
}

(async () => {
  if (runProd) {
    await repair(process.env.MONGODB_URI_PROD, 'PROD');
  } else {
    await repair(process.env.MONGODB_URI, 'LOCAL');
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
