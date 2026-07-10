/**
 * Split TSC Films project into Jay Jagannath, Hanuman Ansh, and PR & Outreach.
 * Moves tasks by title pattern, then deletes the source project.
 *
 * Usage:
 *   node server/scripts/splitTscFilmsProjects.js                    # dry-run (default, local DB)
 *   node server/scripts/splitTscFilmsProjects.js --prod           # dry-run against production
 *   node server/scripts/splitTscFilmsProjects.js --prod --execute   # live run on production
 *   node server/scripts/splitTscFilmsProjects.js --project-id=6a0d58fc...
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Phase = require('../models/Phase');
const { formatProjectName } = require('../utils/formatProjectName');

const EXECUTE = process.argv.includes('--execute');
const USE_PROD = process.argv.includes('--prod');
const DRY_RUN = !EXECUTE;
const BYPASS = { bypassTenant: true };

const PROJECT_ID_ARG = process.argv.find((a) => a.startsWith('--project-id='));
const PROJECT_ID = PROJECT_ID_ARG ? PROJECT_ID_ARG.split('=')[1].trim() : null;

const MONGODB_URI = USE_PROD
  ? (process.env.MONGODB_URI_PROD || process.env.MONGODB_URI)
  : process.env.MONGODB_URI;

const SOURCE_NAME_PATTERNS = [
  /^tsc\s*films?$/i,
  /^tsc$/i,
];

const TARGETS = [
  { key: 'jay', displayName: 'Jay jagannath' },
  { key: 'hanuman', displayName: 'Hanuman ansh' },
  { key: 'pr', displayName: 'PR & Outreach' },
];

function normalizeTitle(title) {
  return String(title || '').trim();
}

function matchesJayJagannath(title) {
  const t = normalizeTitle(title);
  if (!t) return false;
  return /jay\s+jagannath/i.test(t) || /\bjj\b/i.test(t);
}

function matchesHanumanAnshFull(title) {
  return /hanuman\s+ansh/i.test(normalizeTitle(title));
}

function matchesHaStandalone(title) {
  return /\bha\b/i.test(normalizeTitle(title));
}

/**
 * Classify task into target bucket. Jay Jagannath checked first.
 * Returns { key, reason, ambiguous?, dualMatch? }
 */
function classifyTask(title) {
  const jj = matchesJayJagannath(title);
  const haFull = matchesHanumanAnshFull(title);
  const haOnly = !haFull && matchesHaStandalone(title);

  if (jj && (haFull || haOnly)) {
    return { key: 'jay', reason: 'jay-jagannath (also matches HA — JJ wins)', dualMatch: true };
  }
  if (jj) {
    return { key: 'jay', reason: 'jay-jagannath' };
  }
  if (haFull) {
    return { key: 'hanuman', reason: 'hanuman-ansh' };
  }
  if (haOnly) {
    return { key: 'hanuman', reason: 'ha-standalone', ambiguous: true };
  }
  return { key: 'pr', reason: 'remainder' };
}

async function findSourceProject() {
  if (PROJECT_ID) {
    const projects = await Project.find().setOptions(BYPASS).select('name _id workspace owner members memberRoles outletId tenantId color status description tags teams');
    const match = projects.find((p) => p._id.toString().startsWith(PROJECT_ID));
    if (match) return match;
    const byId = await Project.findById(PROJECT_ID).setOptions(BYPASS)
      .select('name _id workspace owner members memberRoles outletId tenantId color status description tags teams');
    if (byId) return byId;
    return null;
  }

  const projects = await Project.find().setOptions(BYPASS).select('name _id workspace owner members memberRoles outletId tenantId color status description tags teams');
  for (const p of projects) {
    const name = p.name || '';
    if (SOURCE_NAME_PATTERNS.some((re) => re.test(name))) {
      return p;
    }
  }
  return null;
}

async function ensureTargetProject(source, displayName) {
  const storedName = formatProjectName(displayName);
  let proj = await Project.findOne({ name: storedName, workspace: source.workspace }).setOptions(BYPASS);

  if (proj) {
    console.log(`  Target exists: ${storedName} (${proj._id})`);
    return proj;
  }

  if (DRY_RUN) {
    console.log(`  Would create target: ${storedName}`);
    return { _id: null, name: storedName, workspace: source.workspace, _dryRun: true };
  }

  proj = await Project.create({
    name: displayName,
    workspace: source.workspace,
    owner: source.owner,
    members: source.members || [],
    memberRoles: source.memberRoles || [],
    outletId: source.outletId || 'main',
    tenantId: source.tenantId,
    status: source.status || 'active',
    description: `Split from ${source.name}`,
    color: source.color,
    tags: source.tags || [],
    teams: source.teams || [],
  });
  console.log(`  Created target: ${storedName} (${proj._id})`);
  return proj;
}

async function buildPhaseMaps(sourceProjectId, targetProjects) {
  const sourcePhases = await Phase.find({ projectId: sourceProjectId }).setOptions(BYPASS);
  const phaseMapByTarget = new Map();

  for (const target of TARGETS) {
    const proj = targetProjects.get(target.key);
    if (!proj || proj._dryRun) {
      phaseMapByTarget.set(target.key, new Map());
      continue;
    }

    const map = new Map();
    for (const sp of sourcePhases) {
      let tp = await Phase.findOne({ projectId: proj._id, name: sp.name }).setOptions(BYPASS);
      if (!tp && !DRY_RUN) {
        tp = await Phase.create({
          name: sp.name,
          description: sp.description,
          projectId: proj._id,
          dueDate: sp.dueDate,
          status: sp.status,
          isExternal: sp.isExternal,
          progress: sp.progress,
          tenantId: sp.tenantId,
        });
        console.log(`    Phase "${sp.name}" → ${proj.name}`);
      } else if (!tp && DRY_RUN) {
        console.log(`    Would create phase "${sp.name}" on ${proj.name}`);
      }
      if (tp) {
        map.set(sp._id.toString(), tp._id);
      }
    }
    phaseMapByTarget.set(target.key, map);
  }

  return { sourcePhases, phaseMapByTarget };
}

async function recalcProjectCounts(projectIds) {
  for (const pid of projectIds) {
    if (!pid) continue;
    const total = await Task.countDocuments({ projectId: pid }).setOptions(BYPASS);
    const completed = await Task.countDocuments({ projectId: pid, status: 'done' }).setOptions(BYPASS);
    await Project.updateOne(
      { _id: pid },
      { $set: { totalTasksCount: total, completedTasksCount: completed } }
    ).setOptions(BYPASS);
  }
}

async function run() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI not set in server/.env');
  }

  await mongoose.connect(MONGODB_URI);
  const dbLabel = MONGODB_URI.includes('production') ? 'production' : (MONGODB_URI.split('/').pop()?.split('?')[0] || 'unknown');
  console.log(DRY_RUN ? '=== DRY RUN (pass --execute to apply) ===' : '=== LIVE RUN ===');
  console.log(`Connected to DB: ${dbLabel}${USE_PROD ? ' (--prod)' : ''}\n`);

  const source = await findSourceProject();
  if (!source) {
    const hint = USE_PROD
      ? 'Source project not found in production DB'
      : 'Source project not found in local DB — already split? Try --prod for production';
    throw new Error(`${hint} (tried: TSC FILMS, Tsc Films, TSC${PROJECT_ID ? `, id prefix ${PROJECT_ID}` : ''})`);
  }
  console.log(`Source: "${source.name}" (${source._id})`);
  console.log(`  workspace=${source.workspace}, outletId=${source.outletId || 'main'}\n`);

  const targetProjects = new Map();
  for (const t of TARGETS) {
    console.log(`Ensuring "${t.displayName}":`);
    targetProjects.set(t.key, await ensureTargetProject(source, t.displayName));
  }
  console.log('');

  const { phaseMapByTarget } = await buildPhaseMaps(source._id, targetProjects);

  const tasks = await Task.find({ projectId: source._id }).setOptions(BYPASS);
  console.log(`Found ${tasks.length} tasks in source project\n`);

  const buckets = {
    jay: { count: 0, samples: [], targetName: formatProjectName('Jay jagannath') },
    hanuman: { count: 0, samples: [], targetName: formatProjectName('Hanuman ansh') },
    pr: { count: 0, samples: [], targetName: formatProjectName('PR & Outreach') },
  };
  const ambiguousHa = [];
  const dualMatches = [];

  for (const task of tasks) {
    const { key, reason, ambiguous, dualMatch } = classifyTask(task.title);
    const bucket = buckets[key];
    bucket.count += 1;
    if (bucket.samples.length < 5) {
      bucket.samples.push(task.title);
    }

    if (ambiguous) {
      ambiguousHa.push({ id: task._id.toString(), title: task.title, reason });
    }
    if (dualMatch) {
      dualMatches.push({ id: task._id.toString(), title: task.title });
    }

    const targetProj = targetProjects.get(key);
    if (!targetProj || targetProj._dryRun) {
      console.log(`  [${bucket.targetName}] (${reason}): ${task.title.slice(0, 70)}`);
      continue;
    }

    const update = {
      projectId: targetProj._id,
      workspace: source.workspace,
    };

    if (task.phaseId) {
      const phaseMap = phaseMapByTarget.get(key);
      const newPhaseId = phaseMap?.get(task.phaseId.toString());
      if (newPhaseId) {
        update.phaseId = newPhaseId;
      } else {
        update.phaseId = null;
      }
    }

    if (!DRY_RUN) {
      await Task.updateOne({ _id: task._id }, { $set: update }).setOptions(BYPASS);
    }
    console.log(`  → ${bucket.targetName} (${reason}): ${task.title.slice(0, 70)}`);
  }

  const remaining = DRY_RUN
    ? tasks.length
    : await Task.countDocuments({ projectId: source._id }).setOptions(BYPASS);

  let sourceDeleted = false;
  if (remaining === 0 && !DRY_RUN) {
    await Phase.deleteMany({ projectId: source._id }).setOptions(BYPASS);
    await Project.deleteOne({ _id: source._id }).setOptions(BYPASS);
    sourceDeleted = true;
    console.log(`\nDeleted source project "${source.name}" (${source._id})`);
  } else if (remaining > 0) {
    console.log(`\nSource NOT deleted — ${remaining} tasks still attached`);
  } else {
    console.log(`\nWould delete source project "${source.name}" (${source._id})`);
  }

  if (!DRY_RUN) {
    const ids = [
      ...TARGETS.map((t) => targetProjects.get(t.key)?._id).filter(Boolean),
    ];
    await recalcProjectCounts(ids);
  }

  console.log('\n========== SUMMARY ==========');
  console.log(`Source project: ${source.name} (${source._id})`);
  console.log(`Jay Jagannath:  ${buckets.jay.count} tasks → ${buckets.jay.targetName}`);
  console.log(`Hanuman Ansh:   ${buckets.hanuman.count} tasks → ${buckets.hanuman.targetName}`);
  console.log(`PR & Outreach:  ${buckets.pr.count} tasks → ${buckets.pr.targetName}`);
  console.log(`Source deleted: ${DRY_RUN ? 'no (dry-run)' : sourceDeleted ? 'yes' : 'no'}`);

  console.log('\nSample tasks per bucket:');
  for (const [k, b] of Object.entries(buckets)) {
    console.log(`  ${b.targetName}:`, b.samples.length ? b.samples : '(none)');
  }

  if (ambiguousHa.length) {
    console.log(`\nAmbiguous "ha" matches (${ambiguousHa.length}):`);
    ambiguousHa.forEach((a) => console.log(`  - [${a.id}] ${a.title}`));
  }
  if (dualMatches.length) {
    console.log(`\nDual JJ+HA matches (${dualMatches.length}, assigned to Jay Jagannath):`);
    dualMatches.forEach((a) => console.log(`  - [${a.id}] ${a.title}`));
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  mongoose.disconnect().finally(() => process.exit(1));
});
