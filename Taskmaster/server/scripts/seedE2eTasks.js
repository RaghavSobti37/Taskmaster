#!/usr/bin/env node
/**
 * Seed idempotent E2E edge-case tasks + daily logs for taskmaster_local.
 *
 * Prereq: node server/scripts/seedE2eUsers.js (writes .agents/e2e-users.json)
 *
 * Usage:
 *   node server/scripts/seedE2eTasks.js
 *   node server/scripts/seedE2eTasks.js --dry-run
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const { formatProjectName } = require('../utils/formatProjectName');
const { formatTimeSpent } = require('../../shared/timeSpent');
const {
  seedCreatedAndAssignments,
  recordStatusChange,
  recordRollback,
} = require('../domains/tasks/services/TaskActivityService');

const BYPASS = { bypassTenant: true };
const E2E_PREFIX = '[E2E]';
const USERS_MANIFEST = path.join(__dirname, '../../.agents/e2e-users.json');
const TASKS_MANIFEST = path.join(__dirname, '../../.agents/e2e-tasks.json');
const DRY_RUN = process.argv.includes('--dry-run');

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d;
};

const daysAhead = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(17, 0, 0, 0);
  return d;
};

function e2eTitle(key) {
  return `${E2E_PREFIX} ${key}`;
}

function loadUsersManifest() {
  if (!fs.existsSync(USERS_MANIFEST)) {
    throw new Error(`Missing ${USERS_MANIFEST} — run seedE2eUsers.js first`);
  }
  return JSON.parse(fs.readFileSync(USERS_MANIFEST, 'utf8'));
}

function indexUsers(manifest) {
  const byArchetype = {};
  for (const user of manifest.users || []) {
    byArchetype[user.archetype] = {
      ...user,
      _id: user.userId ? new mongoose.Types.ObjectId(user.userId) : null,
    };
  }
  return byArchetype;
}

function indexProjects(manifest) {
  const byKey = {};
  for (const project of manifest.projects || []) {
    const name = project.name;
    const key = name.includes('SECONDARY') ? 'secondary' : 'sandbox';
    byKey[key] = {
      ...project,
      _id: project.projectId ? new mongoose.Types.ObjectId(project.projectId) : null,
      name,
    };
  }
  return byKey;
}

function resolveProjectKey(archetype) {
  const secondary = new Set([
    'dept-artist-management',
    'dept-videographer',
    'dept-cg-artist',
  ]);
  return secondary.has(archetype) ? 'secondary' : 'sandbox';
}

function buildTaskSpecs(usersByArchetype) {
  const deptArchetypes = Object.keys(usersByArchetype).filter((k) => k.startsWith('dept-'));

  const specs = [];

  for (const archetype of deptArchetypes) {
    specs.push({
      key: `assignee-${archetype}`,
      title: e2eTitle(`Assignee — ${archetype}`),
      scenario: 'per-dept-assignee',
      projectKey: resolveProjectKey(archetype),
      createdBy: 'dept-admin',
      assignees: [archetype],
      watchers: [],
      status: 'todo',
      priority: 'medium',
    });
  }

  specs.push(
    {
      key: 'owner-pattern',
      title: e2eTitle('Owner pattern'),
      scenario: 'owner-creator',
      projectKey: 'sandbox',
      createdBy: 'dept-admin',
      assignees: ['dept-operations'],
      watchers: ['dept-sales'],
      status: 'todo',
      priority: 'medium',
      description: 'Admin owns task; ops assignee; sales watcher via mention access.',
    },
    {
      key: 'watcher-pattern',
      title: e2eTitle('Watcher pattern'),
      scenario: 'watcher-mention',
      projectKey: 'sandbox',
      createdBy: 'dept-admin',
      assignees: ['dept-sales'],
      watchers: ['dept-editor'],
      status: 'in-progress',
      priority: 'medium',
      description: 'Sales assignee; editor watches without assignment.',
    },
    {
      key: 'multi-assignee',
      title: e2eTitle('Multi assignee'),
      scenario: 'multi-assignee',
      projectKey: 'sandbox',
      createdBy: 'dept-admin',
      assignees: ['dept-sales', 'dept-operations'],
      watchers: [],
      status: 'in-progress',
      priority: 'high',
    },
    {
      key: 'unassigned',
      title: e2eTitle('Unassigned'),
      scenario: 'unassigned',
      projectKey: 'sandbox',
      createdBy: 'dept-admin',
      assignees: [],
      watchers: [],
      status: 'todo',
      priority: 'low',
    },
    {
      key: 'overdue',
      title: e2eTitle('Overdue'),
      scenario: 'overdue',
      projectKey: 'secondary',
      createdBy: 'dept-videographer',
      assignees: ['dept-cg-artist'],
      watchers: [],
      status: 'in-progress',
      priority: 'high',
      dueDate: daysAgo(7),
      notifiedOverdue: true,
    },
    {
      key: 'completed',
      title: e2eTitle('Completed'),
      scenario: 'completed',
      projectKey: 'secondary',
      createdBy: 'dept-videographer',
      assignees: ['dept-videographer'],
      watchers: [],
      status: 'done',
      priority: 'medium',
      completedAt: daysAgo(2),
      actualHours: 2,
      progress: 100,
      seedCompletionLog: true,
    },
    {
      key: 'blocked-prerequisite',
      title: e2eTitle('Blocked prerequisite'),
      scenario: 'blocked-prerequisite',
      projectKey: 'secondary',
      createdBy: 'dept-artist-management',
      assignees: ['dept-artist-management'],
      watchers: [],
      status: 'todo',
      priority: 'medium',
    },
    {
      key: 'blocked-dependent',
      title: e2eTitle('Blocked dependent'),
      scenario: 'blocked-dependent',
      projectKey: 'secondary',
      createdBy: 'dept-artist-management',
      assignees: ['dept-cg-artist'],
      watchers: [],
      status: 'todo',
      priority: 'medium',
      dependsOnKey: 'blocked-prerequisite',
    },
    {
      key: 'high-priority',
      title: e2eTitle('High priority'),
      scenario: 'high-priority',
      projectKey: 'sandbox',
      createdBy: 'dept-admin',
      assignees: ['dept-admin'],
      watchers: [],
      status: 'todo',
      priority: 'critical',
      dueDate: daysAhead(2),
    },
    {
      key: 'role-admin-lead',
      title: e2eTitle('Role — admin lead'),
      scenario: 'project-role-admin-lead',
      projectKey: 'sandbox',
      createdBy: 'dept-admin',
      assignees: ['dept-admin'],
      watchers: [],
      status: 'todo',
      priority: 'medium',
    },
    {
      key: 'role-sales-member',
      title: e2eTitle('Role — sales member'),
      scenario: 'project-role-sales-member',
      projectKey: 'sandbox',
      createdBy: 'dept-admin',
      assignees: ['dept-sales'],
      watchers: [],
      status: 'in-progress',
      priority: 'medium',
    },
    {
      key: 'role-editor-viewer',
      title: e2eTitle('Role — editor viewer'),
      scenario: 'project-role-editor-viewer',
      projectKey: 'sandbox',
      createdBy: 'dept-admin',
      assignees: [],
      watchers: ['dept-editor'],
      status: 'todo',
      priority: 'medium',
      description: 'Editor has viewer project role — mention watcher only.',
    },
    {
      key: 'activity-rich',
      title: e2eTitle('Activity history'),
      scenario: 'activity-history',
      projectKey: 'sandbox',
      createdBy: 'dept-admin',
      assignees: ['dept-sales'],
      watchers: ['dept-editor'],
      status: 'in-progress',
      priority: 'medium',
      seedRichActivity: true,
    },
    {
      key: 'rollback-candidate',
      title: e2eTitle('Rollback candidate'),
      scenario: 'rollback-in-review',
      projectKey: 'sandbox',
      createdBy: 'dept-admin',
      assignees: ['dept-editor'],
      assignerArchetype: 'dept-admin',
      watchers: [],
      status: 'in-review',
      priority: 'medium',
      actualHours: 1.5,
      progress: 100,
      seedRollbackHistory: true,
      seedCompletionLog: true,
    }
  );

  return specs;
}

function userId(usersByArchetype, archetype) {
  const row = usersByArchetype[archetype];
  if (!row?._id) {
    throw new Error(`Missing E2E user for archetype "${archetype}"`);
  }
  return row._id;
}

async function syncAssignments(TaskAssignment, taskId, assigneeIds, assignedById) {
  const existing = await TaskAssignment.find({ taskId }).lean();
  const desired = new Set(assigneeIds.map((id) => id.toString()));
  const existingIds = new Set(existing.map((a) => a.userId.toString()));

  for (const row of existing) {
    if (!desired.has(row.userId.toString())) {
      if (!DRY_RUN) await TaskAssignment.deleteOne({ _id: row._id });
    }
  }

  for (const uid of assigneeIds) {
    if (existingIds.has(uid.toString())) continue;
    if (!DRY_RUN) {
      await TaskAssignment.create({
        taskId,
        userId: uid,
        assignedBy: assignedById,
        assignedAt: new Date(),
      });
    }
  }
}

async function purgeTaskActivities(TaskActivity, taskId) {
  if (!DRY_RUN) {
    await TaskActivity.deleteMany({ taskId }).setOptions(BYPASS);
  }
}

async function seedRichActivity(TaskActivity, task, actor, assigneeId) {
  await purgeTaskActivities(TaskActivity, task._id);
  if (DRY_RUN) return;

  const rows = [
    {
      taskId: task._id,
      type: 'created',
      body: '',
      actorId: actor._id,
      createdAt: daysAgo(5),
    },
    {
      taskId: task._id,
      type: 'assignment',
      body: '',
      actorId: actor._id,
      assigneeId,
      assignedById: actor._id,
      createdAt: daysAgo(5),
    },
    {
      taskId: task._id,
      type: 'message',
      body: 'Kickoff comment for E2E activity stream.',
      actorId: actor._id,
      createdAt: daysAgo(4),
    },
    {
      taskId: task._id,
      type: 'status_change',
      body: '',
      actorId: actor._id,
      statusFrom: 'todo',
      statusTo: 'in-progress',
      createdAt: daysAgo(3),
    },
    {
      taskId: task._id,
      type: 'field_change',
      body: '',
      actorId: actor._id,
      fieldKey: 'dueDate',
      valueFrom: '',
      valueTo: daysAhead(5).toISOString().slice(0, 10),
      createdAt: daysAgo(2),
    },
    {
      taskId: task._id,
      type: 'message',
      body: 'Follow-up comment after status change.',
      actorId: assigneeId,
      createdAt: daysAgo(1),
    },
  ];

  await TaskActivity.insertMany(rows);
}

async function seedRollbackHistory(TaskActivity, task, actor, assigneeId) {
  await purgeTaskActivities(TaskActivity, task._id);
  if (DRY_RUN) return;

  await seedCreatedAndAssignments(
    task,
    [{ userId: assigneeId, assignedBy: actor._id }],
    actor,
    null
  );

  await recordStatusChange(task._id, actor, 'todo', 'in-progress', null);
  await recordStatusChange(task._id, { _id: assigneeId }, 'in-progress', 'in-review', null);

  await TaskActivity.create({
    taskId: task._id,
    type: 'message',
    body: 'Submitted for review — rollback test fixture.',
    actorId: assigneeId,
  });

  await recordRollback(task._id, actor, 'Prior rollback for undo history.', 'in-review', null);
  await recordStatusChange(task._id, actor, 'in-review', 'in-progress', null);
  await recordStatusChange(task._id, { _id: assigneeId }, 'in-progress', 'in-review', null);
}

async function upsertDailyLog(Log, spec, task, userIdValue, projectName) {
  const filter = {
    action: 'DAILY_LOG',
    userId: userIdValue,
    targetId: task._id,
    targetType: 'Task',
    'details.e2eKey': spec.key,
  };

  const doc = {
    userId: userIdValue,
    action: 'DAILY_LOG',
    origin: 'HUMAN_USER',
    actorId: String(userIdValue),
    actionType: 'DAILY_LOG',
    targetEntity: 'Task',
    targetId: task._id,
    targetType: 'Task',
    status: 'SUCCESS',
    details: {
      e2eKey: spec.key,
      type: spec.status === 'in-review' ? 'TASK_COMPLETION' : 'TASK_COMPLETION',
      title: task.title,
      message: spec.status === 'in-review'
        ? `Submitted for review within ${projectName}.`
        : `Successfully completed task within ${projectName}.`,
      project: projectName,
      projectId: task.projectId,
      timeSpent: formatTimeSpent(spec.actualHours || 1),
    },
    payload: undefined,
    createdAt: daysAgo(1),
    timestamp: daysAgo(1),
  };
  doc.payload = doc.details;

  const existing = await Log.findOne(filter).setOptions(BYPASS);
  if (DRY_RUN) return { created: !existing };

  if (existing) {
    await Log.updateOne({ _id: existing._id }, { $set: doc }).setOptions(BYPASS);
    return { created: false };
  }

  await Log.create(doc);
  return { created: true };
}

async function upsertTask(models, spec, context) {
  const {
    Task,
    TaskAssignment,
    TaskActivity,
    Log,
    usersByArchetype,
    projectsByKey,
    taskIdByKey,
  } = models;

  const project = projectsByKey[spec.projectKey];
  if (!project?._id) {
    throw new Error(`Missing project "${spec.projectKey}" in e2e-users manifest`);
  }

  const creatorId = userId(usersByArchetype, spec.createdBy);
  const assigneeIds = (spec.assignees || []).map((a) => userId(usersByArchetype, a));
  const watcherIds = (spec.watchers || []).map((w) => userId(usersByArchetype, w));
  const assignerId = spec.assignerArchetype
    ? userId(usersByArchetype, spec.assignerArchetype)
    : creatorId;

  const dependencies = [];
  if (spec.dependsOnKey) {
    const depId = taskIdByKey[spec.dependsOnKey];
    if (!depId) {
      throw new Error(`Dependency task "${spec.dependsOnKey}" not seeded before "${spec.key}"`);
    }
    dependencies.push(depId);
  }

  const payload = {
    title: spec.title,
    description: spec.description || `E2E fixture: ${spec.scenario}`,
    status: spec.status || 'todo',
    priority: spec.priority || 'medium',
    projectId: project._id,
    workspace: project.workspace || 'GENERAL',
    createdBy: creatorId,
    mentionAccessIds: watcherIds,
    dueDate: spec.dueDate,
    completedAt: spec.completedAt,
    actualHours: spec.actualHours,
    progress: spec.progress,
    notifiedOverdue: spec.notifiedOverdue || false,
    dependencies,
  };

  let task = await Task.findOne({ title: spec.title, projectId: project._id }).setOptions(BYPASS);
  let created = false;

  if (!task) {
    if (!DRY_RUN) {
      task = await Task.create(payload);
    }
    created = true;
  } else if (!DRY_RUN) {
    Object.assign(task, payload);
    task.updatedAt = new Date();
    await task.save();
  }

  if (!task && DRY_RUN) {
    task = { _id: new mongoose.Types.ObjectId(), ...payload };
  }

  if (!DRY_RUN && task?._id) {
    await syncAssignments(TaskAssignment, task._id, assigneeIds, assignerId);

    const actor = { _id: creatorId };
    if (spec.seedRichActivity && assigneeIds[0]) {
      await seedRichActivity(TaskActivity, task, actor, assigneeIds[0]);
    } else if (spec.seedRollbackHistory && assigneeIds[0]) {
      await seedRollbackHistory(TaskActivity, task, actor, assigneeIds[0]);
    } else if (!spec.seedRichActivity && !spec.seedRollbackHistory) {
      const existingActs = await TaskActivity.countDocuments({ taskId: task._id }).setOptions(BYPASS);
      if (existingActs === 0) {
        const assignmentRows = assigneeIds.map((uid) => ({
          userId: uid,
          assignedBy: assignerId,
        }));
        await seedCreatedAndAssignments(task, assignmentRows, actor, null);
      }
    }

    if (spec.seedCompletionLog && assigneeIds[0]) {
      await upsertDailyLog(Log, spec, task, assigneeIds[0], project.name);
    }
  }

  return {
    key: spec.key,
    title: spec.title,
    taskId: task?._id ? String(task._id) : null,
    projectId: String(project._id),
    projectName: project.name,
    scenario: spec.scenario,
    status: spec.status,
    priority: spec.priority,
    assignees: spec.assignees || [],
    watchers: spec.watchers || [],
    dependsOnKey: spec.dependsOnKey || null,
    created,
  };
}

function buildManifest(specs, results, usersManifest) {
  return {
    generatedAt: new Date().toISOString(),
    database: 'taskmaster_local',
    sourceUsersManifest: path.relative(path.join(__dirname, '../..'), USERS_MANIFEST),
    taskCount: results.length,
    createdCount: results.filter((r) => r.created).length,
    tasks: results,
    users: (usersManifest.users || []).map((u) => ({
      archetype: u.archetype,
      userId: u.userId,
      email: u.email,
    })),
    projects: (usersManifest.projects || []).map((p) => ({
      name: p.name,
      projectId: p.projectId,
    })),
  };
}

async function main() {
  const uri = (process.env.MONGODB_URI || process.env.MONGO_URI || '').trim();
  if (!uri) {
    console.error('MONGODB_URI not set in server/.env');
    process.exit(1);
  }
  if (!uri.includes('taskmaster_local')) {
    console.error('Refusing to seed: MONGODB_URI must target taskmaster_local');
    process.exit(1);
  }

  const usersManifest = loadUsersManifest();
  const usersByArchetype = indexUsers(usersManifest);
  const projectsByKey = indexProjects(usersManifest);
  const specs = buildTaskSpecs(usersByArchetype);

  await mongoose.connect(uri);
  console.log(`Connected: ${uri.replace(/\/\/[^@]+@/, '//***@')}`);

  const Task = require('../domains/tasks/models/Task');
  const TaskAssignment = require('../domains/tasks/models/TaskAssignment');
  const TaskActivity = require('../domains/tasks/models/TaskActivity');
  const Log = require('../models/Log');

  const models = {
    Task,
    TaskAssignment,
    TaskActivity,
    Log,
    usersByArchetype,
    projectsByKey,
    taskIdByKey: {},
  };

  const results = [];
  const orderedSpecs = [
    ...specs.filter((s) => !s.dependsOnKey),
    ...specs.filter((s) => s.dependsOnKey),
  ];

  for (const spec of orderedSpecs) {
    const result = await upsertTask(models, spec, {});
    if (result.taskId) models.taskIdByKey[spec.key] = new mongoose.Types.ObjectId(result.taskId);
    results.push(result);
    console.log(`${result.created ? 'created' : 'updated'}: ${spec.title}`);
  }

  const manifest = buildManifest(specs, results, usersManifest);

  if (!DRY_RUN) {
    fs.mkdirSync(path.dirname(TASKS_MANIFEST), { recursive: true });
    fs.writeFileSync(TASKS_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`Manifest: ${TASKS_MANIFEST}`);
  } else {
    console.log('Dry run — manifest not written');
  }

  console.log(`\nE2E tasks: ${manifest.taskCount} (${manifest.createdCount} newly created)`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
