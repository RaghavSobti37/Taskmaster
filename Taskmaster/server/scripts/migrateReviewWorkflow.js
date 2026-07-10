/**
 * One-time migration: self-review in-review tasks → done, backfill creator assignments.
 *
 * Usage (from server/):
 *   node scripts/migrateReviewWorkflow.js --dry-run
 *   node scripts/migrateReviewWorkflow.js --dry-run --prod
 *   node scripts/migrateReviewWorkflow.js --execute --prod
 */
require('dotenv').config();
const mongoose = require('mongoose');
const {
  isSelfWorkOnlyTask,
  getDelegatedAssignments,
  normalizeId,
} = require('../../shared/taskReviewRules');

async function main() {
  const dryRun = !process.argv.includes('--execute');
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
  const User = require('../models/User');

  const inReviewTasks = await Task.find({ status: 'in-review' })
    .select('_id title status projectId createdBy progress actualHours plannedHours completedAt')
    .lean();

  console.log(`\nIn-review tasks: ${inReviewTasks.length}`);

  const taskIds = inReviewTasks.map((t) => t._id);
  const allAssignments = taskIds.length
    ? await TaskAssignment.find({ taskId: { $in: taskIds } }).lean()
    : [];
  const assignmentsByTask = new Map();
  for (const a of allAssignments) {
    const key = String(a.taskId);
    if (!assignmentsByTask.has(key)) assignmentsByTask.set(key, []);
    assignmentsByTask.get(key).push(a);
  }

  const selfReviewTasks = [];
  for (const task of inReviewTasks) {
    const assignments = assignmentsByTask.get(String(task._id)) || [];
    const noDelegated = getDelegatedAssignments(assignments).length === 0;
    if (noDelegated || isSelfWorkOnlyTask(assignments) || assignments.length === 0) {
      selfReviewTasks.push({ task, assignments });
    }
  }

  console.log(`Self-review in-review (will mark done): ${selfReviewTasks.length}`);
  selfReviewTasks.slice(0, 20).forEach(({ task }) => console.log(`  - ${task.title}`));
  if (selfReviewTasks.length > 20) console.log(`  ... and ${selfReviewTasks.length - 20} more`);

  const tasksNeedingCreatorRow = await Task.find({ createdBy: { $exists: true, $ne: null } })
    .select('_id title createdBy')
    .lean();

  const allTaskIds = tasksNeedingCreatorRow.map((t) => t._id);
  const existingAssignments = allTaskIds.length
    ? await TaskAssignment.find({ taskId: { $in: allTaskIds } }).select('taskId userId').lean()
    : [];
  const assigneesByTask = new Map();
  for (const a of existingAssignments) {
    const key = String(a.taskId);
    if (!assigneesByTask.has(key)) assigneesByTask.set(key, new Set());
    assigneesByTask.get(key).add(normalizeId(a.userId));
  }

  const backfillRows = [];
  for (const task of tasksNeedingCreatorRow) {
    const creatorId = normalizeId(task.createdBy);
    if (!creatorId) continue;
    const assignees = assigneesByTask.get(String(task._id));
    if (!assignees || !assignees.has(creatorId)) {
      backfillRows.push({ taskId: task._id, title: task.title, creatorId });
    }
  }

  console.log(`\nCreator assignment backfill: ${backfillRows.length}`);
  backfillRows.slice(0, 15).forEach((r) => console.log(`  - ${r.title}`));
  if (backfillRows.length > 15) console.log(`  ... and ${backfillRows.length - 15} more`);

  if (dryRun) {
    console.log('\nDry run complete. Pass --execute to apply.');
    process.exit(0);
  }

  let markedDone = 0;
  let logsCreated = 0;
  let projectsUpdated = 0;

  for (const { task } of selfReviewTasks) {
    await Task.findByIdAndUpdate(task._id, {
      status: 'done',
      progress: 100,
      completedAt: task.completedAt || new Date(),
    });

    const existingLog = await Log.findOne({
      targetId: task._id,
      targetType: 'Task',
      'details.type': 'TASK_COMPLETION',
    }).lean();

    if (!existingLog) {
      let projectName = 'Unassigned';
      if (task.projectId) {
        const projectDoc = await Project.findById(task.projectId).select('name').lean();
        if (projectDoc) projectName = projectDoc.name;
      }

      const logUserId = normalizeId(task.createdBy);
      const logUser = logUserId ? await User.findById(logUserId).select('_id name').lean() : null;
      const timeSpentStr = task.actualHours > 0
        ? `${task.actualHours}h`
        : (task.plannedHours > 0 ? `${task.plannedHours}h` : '1h');

      await Log.create({
        userId: logUser?._id || logUserId || task.createdBy,
        action: 'DAILY_LOG',
        details: {
          type: 'TASK_COMPLETION',
          title: task.title,
          message: `Successfully completed task within ${projectName}.`,
          project: projectName,
          projectId: task.projectId,
          timeSpent: timeSpentStr,
        },
        targetId: task._id,
        targetType: 'Task',
      });
      logsCreated += 1;
    }

    if (task.projectId) {
      await Project.findByIdAndUpdate(task.projectId, { $inc: { completedTasksCount: 1 } });
      projectsUpdated += 1;
    }

    markedDone += 1;
  }

  if (backfillRows.length) {
    await TaskAssignment.insertMany(
      backfillRows.map((r) => ({
        taskId: r.taskId,
        userId: r.creatorId,
        assignedBy: r.creatorId,
      }))
    );
  }

  console.log(`\nDone. Marked ${markedDone} task(s) done, ${logsCreated} completion log(s), ${projectsUpdated} project count update(s), ${backfillRows.length} creator assignment(s) backfilled.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
