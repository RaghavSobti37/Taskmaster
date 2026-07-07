#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const TaskAssignment = require('../domains/tasks/models/TaskAssignment');
const Task = require('../models/Task');
const Tenant = require('../models/Tenant');

const BYPASS = { bypassTenant: true };
const targetEmail = String(process.env.PLATFORM_OWNER_EMAIL || '').trim().toLowerCase();

async function run(uri, label) {
  await mongoose.connect(uri);
  const tenant = await Tenant.findOne({ slug: 'tsc' }).setOptions(BYPASS).lean();
  const user = targetEmail
    ? await User.findOne({ email: targetEmail }).setOptions(BYPASS).lean()
    : null;
  if (!tenant || !user) {
    console.log(JSON.stringify({ label, tenant: !!tenant, user: !!user }, null, 2));
    await mongoose.disconnect();
    return;
  }

  const assignments = await TaskAssignment.find({
    tenantId: tenant._id,
    userId: user._id,
  }).setOptions(BYPASS).lean();

  const openTaskIds = assignments
    .filter((a) => !a.completed)
    .map((a) => a.taskId)
    .slice(0, 20);

  const sampleOpenTasks = await Task.find({ _id: { $in: openTaskIds } })
    .setOptions(BYPASS)
    .select('title status dueDate priority')
    .lean();

  console.log(JSON.stringify({
    label,
    userId: String(user._id),
    tenantId: String(tenant._id),
    assignmentCount: assignments.length,
    openAssignmentCount: assignments.filter((a) => !a.completed).length,
    sampleOpenTasks,
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
