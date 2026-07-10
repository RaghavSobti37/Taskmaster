/**
 * Seed in-review demo tasks across multiple projects for testing the review UI.
 *
 * Usage (from server/):
 *   node scripts/seedReviewDemoTasks.js
 *   node scripts/seedReviewDemoTasks.js --prod
 *   node scripts/seedReviewDemoTasks.js --clean
 */
require('dotenv').config();

const mongoose = require('mongoose');

const DEMO_PREFIX = '[REVIEW DEMO]';
const DEMO_SPECS = [
  { title: 'Finalize slide deck', projectName: /sandesh/i, assigneeEmail: 'redacted-staff@example.com' },
  { title: 'Export social cuts', projectName: /instagram/i, assigneeEmail: 'atharva@theshakticollective.in' },
  { title: 'Color grade episode 2', projectName: /luca/i, assigneeEmail: 'redacted-staff@example.com' },
  { title: 'Mix master audio', projectName: /havelis|havells/i, assigneeEmail: 'redacted-staff@example.com' },
  { title: 'Update course thumbnails', projectName: /prasad/i, assigneeEmail: 'mahesh@theshakticollective.in' },
];

async function main() {
  const forceDev = process.argv.includes('--dev');
  const forceProd = process.argv.includes('--prod');
  const useProd = forceProd || (!forceDev && process.env.MAIL_USE_PROD_DB === 'true');
  const clean = process.argv.includes('--clean');
  const uri = useProd
    ? process.env.MONGODB_URI_PROD || process.env.MONGODB_URI
    : process.env.MONGODB_URI;

  if (!uri) {
    console.error('No MongoDB URI in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`Connected (${useProd ? 'production' : 'local'}) — matches server when MAIL_USE_PROD_DB=${process.env.MAIL_USE_PROD_DB}`);

  const User = require('../models/User');
  const Project = require('../models/Project');
  const Task = require('../models/Task');
  const TaskAssignment = require('../models/TaskAssignment');

  const reviewer = await User.findOne({ email: 'redacted-staff@example.com' })
    || await User.findOne({ email: 'REDACTED_ADMIN@example.com' });

  if (!reviewer) {
    console.error('No reviewer user (Harshika/Raghav) found');
    process.exit(1);
  }

  if (clean) {
    const existing = await Task.find({ title: new RegExp(`^${DEMO_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).select('_id').lean();
    const ids = existing.map((t) => t._id);
    if (ids.length) {
      await TaskAssignment.deleteMany({ taskId: { $in: ids } });
      await Task.deleteMany({ _id: { $in: ids } });
      console.log(`Removed ${ids.length} demo review task(s)`);
    } else {
      console.log('No demo review tasks to remove');
    }
    process.exit(0);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let created = 0;
  let skipped = 0;

  for (const spec of DEMO_SPECS) {
    const fullTitle = `${DEMO_PREFIX} ${spec.title}`;
    const exists = await Task.findOne({ title: fullTitle }).lean();
    if (exists) {
      skipped += 1;
      console.log('skip (exists):', fullTitle);
      continue;
    }

    const project = await Project.findOne({ name: spec.projectName }).select('name workspace _id').lean();
    if (!project) {
      console.warn('skip (no project):', spec.projectName, fullTitle);
      continue;
    }

    const assignee = await User.findOne({ email: spec.assigneeEmail }).select('name _id').lean();
    if (!assignee) {
      console.warn('skip (no assignee):', spec.assigneeEmail, fullTitle);
      continue;
    }

    const [task] = await Task.create([{
      title: fullTitle,
      description: 'Demo task for review queue UI — safe to delete with --clean',
      status: 'in-review',
      priority: 'medium',
      type: 'general',
      scheduleSlot: 'FULL',
      scheduleDate: today,
      dueDate: today,
      projectId: project._id,
      workspace: project.workspace || 'General',
      actualHours: 1,
      progress: 100,
      createdBy: reviewer._id,
    }]);

    await TaskAssignment.create({
      taskId: task._id,
      userId: assignee._id,
      assignedBy: reviewer._id,
    });

    created += 1;
    console.log('created:', fullTitle, '→', assignee.name, '@', project.name);
  }

  const queue = await Task.find({ status: 'in-review', title: new RegExp(DEMO_PREFIX) })
    .populate('projectId', 'name')
    .lean();
  console.log(`\nDone: ${created} created, ${skipped} skipped. In-review demos: ${queue.length}`);
  queue.forEach((t) => {
    console.log(' -', t.title, '|', t.projectId?.name || 'no project');
  });
  console.log(`\nLog in as ${reviewer.name} (${reviewer.email}) to see Dashboard review section.`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
