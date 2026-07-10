#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const TaskAssignment = require('../domains/tasks/models/TaskAssignment');
const Tenant = require('../models/Tenant');

const BYPASS = { bypassTenant: true };

async function run(uri, label) {
  await mongoose.connect(uri);
  const tenant = await Tenant.findOne({ slug: 'tsc' }).setOptions(BYPASS).lean();
  const assignments = await TaskAssignment.find({ tenantId: tenant._id }).setOptions(BYPASS).lean();
  const userIds = [...new Set(assignments.map((a) => String(a.userId)))];
  const users = await User.find({ _id: { $in: userIds } }).setOptions(BYPASS).select('_id email name').lean();
  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const orphanUserIds = userIds.filter((id) => !userMap.has(id));
  const byUser = new Map();
  for (const a of assignments) {
    const uid = String(a.userId);
    byUser.set(uid, (byUser.get(uid) || 0) + 1);
  }
  const top = [...byUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([uid, count]) => ({
      userId: uid,
      count,
      email: userMap.get(uid)?.email || null,
      name: userMap.get(uid)?.name || null,
    }));

  console.log(JSON.stringify({
    label,
    tenantId: String(tenant._id),
    assignmentTotal: assignments.length,
    distinctAssignees: userIds.length,
    orphanAssigneeIds: orphanUserIds,
    topAssignees: top,
  }, null, 2));
  await mongoose.disconnect();
}

(async () => {
  await run(process.env.MONGODB_URI, 'LOCAL');
  await run(process.env.MONGODB_URI_PROD, 'PROD');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
