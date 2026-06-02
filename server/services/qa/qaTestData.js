const Lead = require('../../models/Lead');
const Contact = require('../../models/Contact');
const CRMAudit = require('../../models/CRMAudit');
const Log = require('../../models/Log');
const User = require('../../models/User');
const Task = require('../../models/Task');
const TaskAssignment = require('../../models/TaskAssignment');
const Project = require('../../models/Project');
const { isRootAdminEmail } = require('../../../shared/rootAdminEmails');

const BYPASS = { bypassTenant: true };

/** Emails created by automated QA probes (qa-*@example.com / qa-*@test.com). */
const QA_EMAIL_PATTERN = /^qa-[a-z0-9-]+@(example\.com|test\.com)$/i;

/** Names prefixed by QA integration / sanitization probes. */
const QA_NAME_PATTERN = /^QA /i;

const QA_SOURCE_PATTERN = /qa integration|qa test/i;

function isQaTestEmail(email) {
  if (!email) return false;
  const normalized = String(email).trim().toLowerCase();
  return QA_EMAIL_PATTERN.test(normalized) || (normalized.startsWith('qa-') && normalized.includes('@'));
}

function isQaTestRecord({ name, email, source } = {}) {
  if (isQaTestEmail(email)) return true;
  if (name && QA_NAME_PATTERN.test(String(name).trim())) return true;
  if (source && QA_SOURCE_PATTERN.test(String(source))) return true;
  return false;
}

/** Mongo filter: leads/contacts created by QA automation. */
function buildQaTestDataFilter() {
  return {
    $or: [
      { email: { $regex: /^qa-/i } },
      { name: { $regex: /^QA /i } },
      { source: { $regex: QA_SOURCE_PATTERN } },
    ],
  };
}

/** Exclude QA probe rows from Data Hub "All Data" and folder counts. */
function buildDataHubExcludeFilter() {
  return {
    $nor: [
      { email: { $regex: /^qa-/i } },
      { name: { $regex: /^QA /i } },
    ],
  };
}

/** Mongo filter: QA probe user accounts (e.g. QA Login Probe from auth checklist). */
function buildQaUserFilter() {
  return {
    $or: [
      { email: { $regex: /^qa-/i } },
      { name: { $regex: /^QA /i } },
    ],
  };
}

/** Mongo filter: tasks created by QA automation / sanitization probes. */
function buildQaTaskFilter() {
  return {
    $or: [
      { title: { $regex: /^QA /i } },
      { title: { $regex: /^\[QA BUG\]/i } },
      { title: { $regex: /<script/i } },
      { title: { $regex: /alert\s*\(\s*['"]xss['"]\s*\)/i } },
      { title: { $regex: /^Backdated QA/i } },
    ],
  };
}

async function purgeQaUsers() {
  const candidates = await User.find(buildQaUserFilter()).setOptions(BYPASS).select('_id email').lean();
  const idsToDelete = candidates.filter((u) => !isRootAdminEmail(u.email)).map((u) => u._id);
  if (!idsToDelete.length) return { deletedCount: 0 };

  const result = await User.deleteMany({ _id: { $in: idsToDelete } }).setOptions(BYPASS);
  return { deletedCount: result.deletedCount || 0 };
}

async function purgeQaTasks() {
  const tasks = await Task.find(buildQaTaskFilter()).setOptions(BYPASS).select('_id status projectId').lean();
  if (!tasks.length) return { deletedCount: 0, assignments: 0, logs: 0 };

  const taskIds = tasks.map((t) => t._id);
  const projectDeltas = new Map();
  for (const task of tasks) {
    if (!task.projectId) continue;
    const key = String(task.projectId);
    const delta = projectDeltas.get(key) || { totalTasksCount: 0, completedTasksCount: 0 };
    delta.totalTasksCount -= 1;
    if (task.status === 'done') delta.completedTasksCount -= 1;
    projectDeltas.set(key, delta);
  }

  const [assignments, logs, taskResult] = await Promise.all([
    TaskAssignment.deleteMany({ taskId: { $in: taskIds } }),
    Log.deleteMany({
      $or: [
        { targetId: { $in: taskIds } },
        { targetType: 'Task', targetId: { $in: taskIds.map(String) } },
      ],
    }).setOptions(BYPASS),
    Task.deleteMany({ _id: { $in: taskIds } }).setOptions(BYPASS),
  ]);

  await Promise.all(
    [...projectDeltas.entries()].map(([projectId, delta]) =>
      Project.findByIdAndUpdate(projectId, { $inc: delta }).setOptions(BYPASS)
    )
  );

  return {
    deletedCount: taskResult.deletedCount || 0,
    assignments: assignments.deletedCount || 0,
    logs: logs.deletedCount || 0,
  };
}

async function purgeQaTestData() {
  const filter = buildQaTestDataFilter();
  const leadIds = await Lead.find(filter).setOptions(BYPASS).select('_id').lean();
  const ids = leadIds.map((l) => l._id);

  const [contacts, audits, leads, logs, users, tasks] = await Promise.all([
    Contact.deleteMany(filter).setOptions(BYPASS),
    ids.length ? CRMAudit.deleteMany({ leadId: { $in: ids } }).setOptions(BYPASS) : { deletedCount: 0 },
    Lead.deleteMany(filter).setOptions(BYPASS),
    Log.deleteMany({
      $or: [
        { action: 'QA_TEST' },
        { module: 'QA_TESTING' },
        { origin: 'QA_AGENT_TEST' },
        { 'details.title': { $regex: /^QA /i } },
      ],
    }).setOptions(BYPASS),
    purgeQaUsers(),
    purgeQaTasks(),
  ]);

  return {
    deleted: {
      contacts: contacts.deletedCount || 0,
      leads: leads.deletedCount || 0,
      audits: audits.deletedCount || 0,
      logs: logs.deletedCount || 0,
      users: users.deletedCount || 0,
      tasks: tasks.deletedCount || 0,
      taskAssignments: tasks.assignments || 0,
    },
  };
}

async function purgeQaIdentity({ email, phone } = {}) {
  const clauses = [];
  if (email) clauses.push({ email: String(email).trim().toLowerCase() });
  if (phone) clauses.push({ phone });
  if (!clauses.length) return;

  const match = clauses.length === 1 ? clauses[0] : { $or: clauses };
  const leads = await Lead.find(match).setOptions(BYPASS).select('_id').lean();
  const leadIds = leads.map((l) => l._id);

  await Promise.all([
    Contact.deleteMany(match).setOptions(BYPASS),
    leadIds.length ? CRMAudit.deleteMany({ leadId: { $in: leadIds } }).setOptions(BYPASS) : Promise.resolve(),
    Lead.deleteMany(match).setOptions(BYPASS),
  ]);
}

module.exports = {
  isQaTestEmail,
  isQaTestRecord,
  buildQaTestDataFilter,
  buildQaUserFilter,
  buildQaTaskFilter,
  buildDataHubExcludeFilter,
  purgeQaUsers,
  purgeQaTasks,
  purgeQaTestData,
  purgeQaIdentity,
};
