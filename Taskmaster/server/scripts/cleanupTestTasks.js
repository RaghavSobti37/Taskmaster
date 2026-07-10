/**
 * Remove test/demo tasks from the database and reconcile project counts.
 *
 * Usage (from server/):
 *   node scripts/cleanupTestTasks.js --dry-run
 *   node scripts/cleanupTestTasks.js --prod
 *   node scripts/cleanupTestTasks.js --dev
 */
require('dotenv').config();

const mongoose = require('mongoose');

const TEST_TITLE_FILTER = {
  $or: [
    { title: /^(\[REVIEW DEMO\])/i },
    { title: /prod test/i },
    { title: /test presentation/i },
    { title: /^NEXUS PRIME:/i },
    { title: /^QUANTUM SHIFT:/i },
    { title: /^VOID WALKER:/i },
  ],
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const forceDev = process.argv.includes('--dev');
  const forceProd = process.argv.includes('--prod');
  const useProd = forceProd || (!forceDev && process.env.MAIL_USE_PROD_DB === 'true');
  const uri = useProd
    ? process.env.MONGODB_URI_PROD || process.env.MONGODB_URI
    : process.env.MONGODB_URI;

  if (!uri) {
    console.error('No MongoDB URI in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`${dryRun ? '[DRY RUN] ' : ''}Connected (${useProd ? 'production' : 'local'})`);

  const Task = require('../models/Task');
  const TaskAssignment = require('../models/TaskAssignment');
  const Project = require('../models/Project');
  const Log = require('../models/Log');

  const tasks = await Task.find(TEST_TITLE_FILTER)
    .select('_id title status projectId')
    .lean();

  if (tasks.length === 0) {
    console.log('No test tasks matched.');
    process.exit(0);
  }

  console.log(`Found ${tasks.length} test task(s):`);
  tasks.forEach((t) => console.log(` - ${t.title} (${t.status})`));

  const projectDeltas = new Map();
  for (const task of tasks) {
    if (!task.projectId) continue;
    const key = String(task.projectId);
    const delta = projectDeltas.get(key) || { totalTasksCount: 0, completedTasksCount: 0 };
    delta.totalTasksCount -= 1;
    if (task.status === 'done') delta.completedTasksCount -= 1;
    projectDeltas.set(key, delta);
  }

  const taskIds = tasks.map((t) => t._id);

  if (dryRun) {
    console.log('Would delete assignments, logs, tasks, and update projects:', Object.fromEntries(projectDeltas));
    process.exit(0);
  }

  const assignResult = await TaskAssignment.deleteMany({ taskId: { $in: taskIds } });
  const logResult = await Log.deleteMany({
    $or: [
      { targetId: { $in: taskIds } },
      { targetType: 'Task', targetId: { $in: taskIds.map(String) } },
    ],
  });
  const taskResult = await Task.deleteMany({ _id: { $in: taskIds } });

  for (const [projectId, delta] of projectDeltas) {
    await Project.findByIdAndUpdate(projectId, { $inc: delta });
  }

  console.log(`Deleted ${taskResult.deletedCount} task(s), ${assignResult.deletedCount} assignment(s), ${logResult.deletedCount} log(s)`);
  console.log(`Updated ${projectDeltas.size} project count(s)`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
