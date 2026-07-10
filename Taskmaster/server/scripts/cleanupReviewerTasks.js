/**
 * Delete in-review tasks where a user is the assigner (strict reviewer).
 *
 * Usage (from server/):
 *   node scripts/cleanupReviewerTasks.js --dry-run --prod
 *   node scripts/cleanupReviewerTasks.js --prod --email ragha@example.com
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const forceProd = process.argv.includes('--prod');
  const emailArg = process.argv.find((a) => a.startsWith('--email='));
  const email = emailArg ? emailArg.split('=')[1] : process.env.REVIEWER_CLEANUP_EMAIL;

  const useProd = forceProd || process.env.MAIL_USE_PROD_DB === 'true';
  const uri = useProd
    ? process.env.MONGODB_URI_PROD || process.env.MONGODB_URI
    : process.env.MONGODB_URI;

  if (!uri) {
    console.error('No MongoDB URI in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`${dryRun ? '[DRY RUN] ' : ''}Connected (${useProd ? 'production' : 'local'})`);

  const User = require('../models/User');
  const Task = require('../models/Task');
  const TaskAssignment = require('../models/TaskAssignment');
  const Project = require('../models/Project');
  const Log = require('../models/Log');

  let reviewer;
  if (email) {
    reviewer = await User.findOne({ email: new RegExp(`^${email}$`, 'i') });
  } else {
    reviewer = await User.findOne({ email: /raghav/i });
  }

  if (!reviewer) {
    console.error('Reviewer user not found. Pass --email=you@domain.com');
    process.exit(1);
  }

  console.log(`Reviewer: ${reviewer.name} (${reviewer.email})`);

  const assignments = await TaskAssignment.find({ assignedBy: reviewer._id }).select('taskId').lean();
  const candidateIds = [...new Set(assignments.map((a) => String(a.taskId)))];

  const tasks = await Task.find({
    _id: { $in: candidateIds },
    status: 'in-review',
  })
    .select('_id title status projectId')
    .lean();

  if (tasks.length === 0) {
    console.log('No in-review tasks where this user is assigner.');
    process.exit(0);
  }

  console.log(`Found ${tasks.length} task(s):`);
  tasks.forEach((t) => console.log(` - ${t.title} (${t.status})`));

  const projectDeltas = new Map();
  for (const task of tasks) {
    if (!task.projectId) continue;
    const key = String(task.projectId);
    const delta = projectDeltas.get(key) || { totalTasksCount: 0, completedTasksCount: 0 };
    delta.totalTasksCount -= 1;
    projectDeltas.set(key, delta);
  }

  const taskIds = tasks.map((t) => t._id);

  if (dryRun) {
    console.log('Would delete assignments, logs, tasks, update projects:', Object.fromEntries(projectDeltas));
    process.exit(0);
  }

  await TaskAssignment.deleteMany({ taskId: { $in: taskIds } });
  await Log.deleteMany({
    $or: [
      { targetId: { $in: taskIds } },
      { targetType: 'Task', targetId: { $in: taskIds.map(String) } },
    ],
  });
  const taskResult = await Task.deleteMany({ _id: { $in: taskIds } });

  for (const [projectId, delta] of projectDeltas) {
    await Project.findByIdAndUpdate(projectId, { $inc: delta });
  }

  console.log(`Deleted ${taskResult.deletedCount} task(s); updated ${projectDeltas.size} project count(s)`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
