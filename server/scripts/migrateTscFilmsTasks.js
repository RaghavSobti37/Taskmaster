/**
 * Restructure TSC Films tasks into Jay Jagannath, Hanuman Ansh, and PR & Outreach projects.
 * Usage: node server/scripts/migrateTscFilmsTasks.js [--dry-run]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');

const DRY_RUN = process.argv.includes('--dry-run');
const WORKSPACE = 'TSC FILMS';
const SOURCE_NAMES = ['Tsc Films', 'TSC Films', 'tsc films'];

const TARGETS = [
  { name: 'Jay Jagannath Project', match: (title) => /\bjj\b|jay jagannath/i.test(title) },
  { name: 'Hanuman Ansh Project', match: (title) => /\bha\b|hanuman ansh/i.test(title) },
  { name: 'PR & Outreach', match: () => true },
];

const MEMBER_NAMES = ['Harshika', 'Rohith', 'Deepank'];

async function findUsersByNameParts() {
  const users = await User.find().select('_id name email');
  return MEMBER_NAMES.map((part) => {
    const found = users.find((u) => u.name?.toLowerCase().includes(part.toLowerCase()));
    if (!found) throw new Error(`User matching "${part}" not found`);
    return found;
  });
}

function resolveTarget(title) {
  for (const t of TARGETS.slice(0, 2)) {
    if (t.match(title)) return t.name;
  }
  return TARGETS[2].name;
}

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(DRY_RUN ? 'DRY RUN — no writes' : 'LIVE RUN');
  console.log('Connected to DB');

  const members = await findUsersByNameParts();
  console.log('Members:', members.map((m) => m.name).join(', '));

  let sourceProject = null;
  for (const name of SOURCE_NAMES) {
    sourceProject = await Project.findOne({ name: new RegExp(`^${name}$`, 'i') });
    if (sourceProject) break;
  }
  if (!sourceProject) {
    throw new Error('Source project "Tsc Films" not found');
  }
  console.log('Source project:', sourceProject.name, sourceProject._id.toString());

  const projectMap = new Map();
  for (const target of TARGETS) {
    let proj = await Project.findOne({ name: target.name, workspace: WORKSPACE });
    if (!proj && !DRY_RUN) {
      proj = await Project.create({
        name: target.name,
        workspace: WORKSPACE,
        owner: members[0]._id,
        members: members.map((m) => m._id),
        memberRoles: members.map((m) => ({ user: m._id, role: 'member' })),
        status: 'active',
        description: `Split from ${sourceProject.name}`,
      });
      console.log('Created project:', target.name);
    } else if (proj && !DRY_RUN) {
      await Project.updateOne(
        { _id: proj._id },
        {
          $addToSet: { members: { $each: members.map((m) => m._id) } },
          $set: { workspace: WORKSPACE },
        }
      );
      console.log('Updated project members:', target.name);
    } else {
      console.log('Would ensure project:', target.name);
    }
    projectMap.set(target.name, proj?._id);
  }

  const tasks = await Task.find({ projectId: sourceProject._id });
  console.log(`Found ${tasks.length} tasks in source project`);

  const counts = { 'Jay Jagannath Project': 0, 'Hanuman Ansh Project': 0, 'PR & Outreach': 0, ambiguous: [] };

  for (const task of tasks) {
    const title = task.title || '';
    let targetName = resolveTarget(title);

    const jj = TARGETS[0].match(title);
    const ha = TARGETS[1].match(title);
    if (jj && ha) {
      counts.ambiguous.push({ id: task._id.toString(), title });
      targetName = 'PR & Outreach';
    }

    counts[targetName] = (counts[targetName] || 0) + 1;

    if (!DRY_RUN && projectMap.get(targetName)) {
      await Task.updateOne(
        { _id: task._id },
        { $set: { projectId: projectMap.get(targetName), workspace: WORKSPACE } }
      );
    }
    console.log(`  → ${targetName}: ${title.slice(0, 60)}`);
  }

  console.log('\nSummary:', counts);
  if (counts.ambiguous.length) {
    console.log('Ambiguous (both JJ and HA patterns):', counts.ambiguous);
  }
  process.exit(0);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
