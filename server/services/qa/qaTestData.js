const Lead = require('../../models/Lead');
const Contact = require('../../models/Contact');
const CRMAudit = require('../../models/CRMAudit');
const Log = require('../../models/Log');
const User = require('../../models/User');
const Task = require('../../models/Task');
const TaskAssignment = require('../../models/TaskAssignment');
const Project = require('../../models/Project');
const FinanceDocument = require('../../models/FinanceDocument');
const Notification = require('../../models/Notification');
const XPAuditLog = require('../../models/XPAuditLog');
const Person = require('../../models/Person');
const PersonIdentifier = require('../../models/PersonIdentifier');
const PersonCommunicationProfile = require('../../models/PersonCommunicationProfile');
const PersonSourceLink = require('../../models/PersonSourceLink');
const { normalizePhone, sanitizeEmail } = require('../../utils/sanitizer');
const { isRootAdminEmail } = require('../../../shared/rootAdminEmails');
const { refreshAttendanceMetricsForUserDay } = require('../../utils/refreshAttendanceMetrics');
const crypto = require('crypto');

const BYPASS = { bypassTenant: true };

/** Unique 10-digit Indian mobile for QA probes (avoids Date.now() collisions). */
function qaUniquePhone(prefixDigit = '9') {
  const suffix = crypto.randomInt(100000000, 999999999);
  return `${prefixDigit}${suffix}`.slice(0, 10);
}

function qaUniqueEmail(label = 'qa') {
  return `${label}-${Date.now()}-${crypto.randomInt(1000, 9999)}@example.com`;
}

async function purgePersonGoldenRecords({ email, phone } = {}) {
  const normalizedEmail = email ? sanitizeEmail(email) || String(email).trim().toLowerCase() : null;
  const normalizedPhone = phone ? normalizePhone(phone) || phone : null;
  const idClauses = [];
  if (normalizedEmail) idClauses.push({ type: 'email', valueNormalized: normalizedEmail });
  if (normalizedPhone) idClauses.push({ type: 'phone', valueNormalized: normalizedPhone });
  if (!idClauses.length) return;

  const identifierRows = await PersonIdentifier.find({ $or: idClauses })
    .setOptions(BYPASS)
    .select('personId')
    .lean();
  const personIds = [...new Set(identifierRows.map((row) => String(row.personId)).filter(Boolean))];
  if (!personIds.length) return;

  const objectIds = personIds.map((id) => id);
  await Promise.all([
    PersonCommunicationProfile.deleteMany({ personId: { $in: objectIds } }).setOptions(BYPASS),
    PersonSourceLink.deleteMany({ personId: { $in: objectIds } }).setOptions(BYPASS),
    PersonIdentifier.deleteMany({ personId: { $in: objectIds } }).setOptions(BYPASS),
    Person.deleteMany({ _id: { $in: objectIds } }).setOptions(BYPASS),
  ]);
}

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
      { title: { $regex: /^QA probe bug/i } },
    ],
  };
}

function buildQaFinanceFilter() {
  return { title: { $regex: /^QA /i } };
}

function buildQaProjectFilter() {
  return { name: { $regex: /^QA /i } };
}

async function collectQaTaskIds() {
  const tasks = await Task.find(buildQaTaskFilter()).setOptions(BYPASS).select('_id').lean();
  return tasks.map((t) => t._id);
}

async function collectQaLeadIds() {
  const leads = await Lead.find(buildQaTestDataFilter()).setOptions(BYPASS).select('_id').lean();
  return leads.map((l) => l._id);
}

async function collectQaUserIds() {
  const users = await User.find(buildQaUserFilter()).setOptions(BYPASS).select('_id').lean();
  return users.map((u) => u._id);
}

/** Daily log rows created by QA task flows (assignee/reviewer hours on real or probe users). */
function buildQaDailyLogFilter({ taskIds = [], qaUserIds = [] } = {}) {
  const orClauses = [
    { 'details.title': { $regex: /^QA /i } },
    { 'details.title': { $regex: /^\[QA BUG\]/i } },
    { 'details.title': { $regex: /^Backdated QA/i } },
    { 'details.title': { $regex: /^QA probe bug/i } },
  ];
  if (taskIds.length) {
    orClauses.push({ targetId: { $in: taskIds } });
    orClauses.push({ targetId: { $in: taskIds.map(String) } });
  }
  if (qaUserIds.length) {
    orClauses.push({ userId: { $in: qaUserIds } });
  }
  return {
    action: 'DAILY_LOG',
    $or: orClauses,
  };
}

async function deleteTasksByIds(taskIds) {
  if (!taskIds.length) return { deletedCount: 0, assignments: 0, logs: 0 };

  const tasks = await Task.find({ _id: { $in: taskIds } }).setOptions(BYPASS).select('_id status projectId').lean();
  const ids = tasks.map((t) => t._id);
  if (!ids.length) return { deletedCount: 0, assignments: 0, logs: 0 };

  const projectDeltas = new Map();
  for (const task of tasks) {
    if (!task.projectId) continue;
    const key = String(task.projectId);
    const delta = projectDeltas.get(key) || { totalTasksCount: 0, completedTasksCount: 0 };
    delta.totalTasksCount -= 1;
    if (task.status === 'done') delta.completedTasksCount -= 1;
    projectDeltas.set(key, delta);
  }

  const [assignments, logs, taskResult, notifications, xpAudits] = await Promise.all([
    TaskAssignment.deleteMany({ taskId: { $in: ids } }),
    Log.deleteMany({
      $or: [
        { targetId: { $in: ids } },
        { targetType: 'Task', targetId: { $in: ids.map(String) } },
      ],
    }).setOptions(BYPASS),
    Task.deleteMany({ _id: { $in: ids } }).setOptions(BYPASS),
    Notification.deleteMany({ relatedTaskId: { $in: ids } }).setOptions(BYPASS),
    XPAuditLog.deleteMany({ 'details.taskId': { $in: ids } }),
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
    notifications: notifications.deletedCount || 0,
    xpAudits: xpAudits.deletedCount || 0,
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
  const taskIds = await collectQaTaskIds();
  return deleteTasksByIds(taskIds);
}

async function purgeQaNotifications(taskIds, leadIds) {
  const clauses = [{ title: { $regex: /^QA /i } }];
  if (taskIds.length) clauses.push({ relatedTaskId: { $in: taskIds } });
  if (leadIds.length) clauses.push({ relatedLeadId: { $in: leadIds } });
  const result = await Notification.deleteMany({ $or: clauses }).setOptions(BYPASS);
  return result.deletedCount || 0;
}

async function purgeQaDailyLogs({ taskIds = [], qaUserIds = [] } = {}) {
  const filter = buildQaDailyLogFilter({ taskIds, qaUserIds });
  const rows = await Log.find(filter).setOptions(BYPASS).select('userId createdAt').lean();
  const affectedUserIds = [...new Set(rows.map((r) => r.userId).filter(Boolean).map(String))];
  const result = await Log.deleteMany(filter).setOptions(BYPASS);

  for (const row of rows) {
    if (row.userId && row.createdAt) {
      refreshAttendanceMetricsForUserDay(row.userId, row.createdAt).catch(() => {});
    }
  }

  return { deletedCount: result.deletedCount || 0, affectedUserIds };
}

function buildQaActivityLogFilter() {
  return {
    $or: [
      { action: 'QA_TEST' },
      { module: 'QA_TESTING' },
      { origin: 'QA_AGENT_TEST' },
      { action: 'QA_ASSERTION' },
      { 'details.title': { $regex: /^QA /i } },
      { 'details.testName': { $regex: /^QA /i } },
    ],
  };
}

function buildQaXpAuditFilter({ taskIds = [], leadIds = [], logIds = [] } = {}) {
  const clauses = [{ 'details.qaProbe': true }];
  if (taskIds.length) clauses.push({ 'details.taskId': { $in: taskIds } });
  if (leadIds.length) clauses.push({ 'details.leadId': { $in: leadIds } });
  if (logIds.length) clauses.push({ 'details.logId': { $in: logIds } });
  return { $or: clauses };
}

async function collectQaLogIds() {
  const logs = await Log.find(buildQaActivityLogFilter()).setOptions(BYPASS).select('_id').lean();
  return logs.map((l) => l._id);
}

/** Remove XP audit rows and activity logs created by QA automation (incl. orphan qaProbe rows). */
async function purgeQaGamificationData(options = {}) {
  const [taskIds, leadIds, logIds] = await Promise.all([
    options.taskIds ? Promise.resolve(options.taskIds) : collectQaTaskIds(),
    options.leadIds ? Promise.resolve(options.leadIds) : collectQaLeadIds(),
    options.logIds ? Promise.resolve(options.logIds) : collectQaLogIds(),
  ]);
  const xpFilter = buildQaXpAuditFilter({ taskIds, leadIds, logIds });

  const xpRows = await XPAuditLog.find(xpFilter).select('userId').lean();
  const affectedUserIds = [...new Set(xpRows.map((r) => r.userId).filter(Boolean))];

  const [xpResult, logResult] = await Promise.all([
    XPAuditLog.deleteMany(xpFilter),
    Log.deleteMany(buildQaActivityLogFilter()).setOptions(BYPASS),
  ]);

  return {
    deletedXpAudits: xpResult.deletedCount || 0,
    deletedQaLogs: logResult.deletedCount || 0,
    affectedUserIds,
  };
}

async function purgeQaXpAudits(taskIds, leadIds) {
  const result = await XPAuditLog.deleteMany(
    buildQaXpAuditFilter({ taskIds, leadIds, logIds: await collectQaLogIds() })
  );
  return result.deletedCount || 0;
}

async function purgeQaFinance() {
  const result = await FinanceDocument.deleteMany(buildQaFinanceFilter()).setOptions(BYPASS);
  return result.deletedCount || 0;
}

async function purgeQaProjects() {
  const projects = await Project.find(buildQaProjectFilter()).setOptions(BYPASS).select('_id').lean();
  const ids = projects.map((p) => p._id);
  if (!ids.length) return 0;
  const result = await Project.deleteMany({ _id: { $in: ids } }).setOptions(BYPASS);
  return result.deletedCount || 0;
}

async function purgeQaLeadsAndContacts() {
  const filter = buildQaTestDataFilter();
  const leadIds = await collectQaLeadIds();

  const [contacts, audits, leads, leadXp, leadNotifications] = await Promise.all([
    Contact.deleteMany(filter).setOptions(BYPASS),
    leadIds.length ? CRMAudit.deleteMany({ leadId: { $in: leadIds } }).setOptions(BYPASS) : { deletedCount: 0 },
    Lead.deleteMany(filter).setOptions(BYPASS),
    leadIds.length ? XPAuditLog.deleteMany({ 'details.leadId': { $in: leadIds } }) : { deletedCount: 0 },
    leadIds.length
      ? Notification.deleteMany({ relatedLeadId: { $in: leadIds } }).setOptions(BYPASS)
      : { deletedCount: 0 },
  ]);

  return {
    contacts: contacts.deletedCount || 0,
    leads: leads.deletedCount || 0,
    audits: audits.deletedCount || 0,
    leadXp: leadXp.deletedCount || 0,
    leadNotifications: leadNotifications.deletedCount || 0,
  };
}

async function purgeQaTestData() {
  const [taskIds, leadIds, qaUserIds] = await Promise.all([
    collectQaTaskIds(),
    collectQaLeadIds(),
    collectQaUserIds(),
  ]);

  const dailyLogs = await purgeQaDailyLogs({ taskIds, qaUserIds });

  const [crm, tasks, users, finance, projects, notifications, gamification] = await Promise.all([
    purgeQaLeadsAndContacts(),
    purgeQaTasks(),
    purgeQaUsers(),
    purgeQaFinance(),
    purgeQaProjects(),
    purgeQaNotifications(taskIds, leadIds),
    purgeQaGamificationData({ taskIds, leadIds }),
  ]);

  const affectedUserIds = [
    ...new Set([
      ...(gamification.affectedUserIds || []).map(String),
      ...(dailyLogs.affectedUserIds || []),
    ]),
  ];

  return {
    deleted: {
      contacts: crm.contacts,
      leads: crm.leads,
      audits: crm.audits,
      logs: (gamification.deletedQaLogs || 0) + (dailyLogs.deletedCount || 0),
      dailyLogs: dailyLogs.deletedCount || 0,
      users: users.deletedCount || 0,
      tasks: tasks.deletedCount || 0,
      taskAssignments: tasks.assignments || 0,
      notifications: notifications + (crm.leadNotifications || 0) + (tasks.notifications || 0),
      xpAudits:
        (gamification.deletedXpAudits || 0) + (crm.leadXp || 0) + (tasks.xpAudits || 0),
      finance,
      projects,
    },
    affectedUserIds,
  };
}

async function purgeQaIdentity({ email, phone } = {}) {
  const normalizedEmail = email ? sanitizeEmail(email) || String(email).trim().toLowerCase() : null;
  const normalizedPhone = phone ? normalizePhone(phone) || phone : null;
  const clauses = [];
  if (normalizedEmail) clauses.push({ email: normalizedEmail });
  if (normalizedPhone) clauses.push({ phone: normalizedPhone });
  if (!clauses.length) return;

  await purgePersonGoldenRecords({ email: normalizedEmail, phone: normalizedPhone });

  const match = clauses.length === 1 ? clauses[0] : { $or: clauses };
  const leads = await Lead.find(match).setOptions(BYPASS).select('_id').lean();
  const leadIds = leads.map((l) => l._id);

  await Promise.all([
    Contact.deleteMany(match).setOptions(BYPASS),
    leadIds.length ? CRMAudit.deleteMany({ leadId: { $in: leadIds } }).setOptions(BYPASS) : Promise.resolve(),
    leadIds.length ? Notification.deleteMany({ relatedLeadId: { $in: leadIds } }).setOptions(BYPASS) : Promise.resolve(),
    leadIds.length ? XPAuditLog.deleteMany({ 'details.leadId': { $in: leadIds } }) : Promise.resolve(),
    Lead.deleteMany(match).setOptions(BYPASS),
  ]);
}

/** Delete one tracked artifact from a QA run (cascade children). */
async function deleteTrackedArtifact(artifact) {
  if (!artifact?.type || !artifact?.id) return { ok: false, reason: 'invalid' };

  const id = artifact.id;
  switch (artifact.type) {
    case 'task': {
      const r = await deleteTasksByIds([id]);
      return { ok: true, ...r };
    }
    case 'lead': {
      const lead = await Lead.findById(id).setOptions(BYPASS).select('email phone name').lean();
      const leadIds = [id];
      const contactMatch = lead
        ? {
            $or: [
              ...(lead.email ? [{ email: lead.email }] : []),
              ...(lead.phone ? [{ phone: lead.phone }] : []),
            ],
          }
        : null;
      await Promise.all([
        CRMAudit.deleteMany({ leadId: { $in: leadIds } }).setOptions(BYPASS),
        Notification.deleteMany({ relatedLeadId: { $in: leadIds } }).setOptions(BYPASS),
        XPAuditLog.deleteMany({ 'details.leadId': { $in: leadIds } }),
        contactMatch?.$or?.length
          ? Contact.deleteMany(contactMatch).setOptions(BYPASS)
          : Promise.resolve(),
        Lead.deleteOne({ _id: id }).setOptions(BYPASS),
        purgePersonGoldenRecords({
          email: lead?.email,
          phone: lead?.phone,
        }),
      ]);
      return { ok: true };
    }
    case 'contact':
      await Contact.deleteOne({ _id: id }).setOptions(BYPASS);
      return { ok: true };
    case 'finance':
      await FinanceDocument.deleteOne({ _id: id }).setOptions(BYPASS);
      return { ok: true };
    case 'project':
      await Project.deleteOne({ _id: id }).setOptions(BYPASS);
      return { ok: true };
    case 'log':
      await Log.deleteOne({ _id: id }).setOptions(BYPASS);
      return { ok: true };
    case 'user': {
      const u = await User.findById(id).select('email').lean();
      if (u && !isRootAdminEmail(u.email)) {
        await User.deleteOne({ _id: id }).setOptions(BYPASS);
      }
      return { ok: true };
    }
    default:
      return { ok: false, reason: `unknown type ${artifact.type}` };
  }
}

/** Purge artifacts recorded on a single QATestRun (+ bug tasks). */
async function purgeQaRunArtifacts(testRun) {
  const seen = new Set();
  const artifacts = [];
  for (const a of testRun?.createdArtifacts || []) {
    const key = `${a.type}:${a.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      artifacts.push(a);
    }
  }
  for (const bugId of testRun?.bugsCreated || []) {
    const key = `task:${bugId}`;
    if (!seen.has(key)) {
      seen.add(key);
      artifacts.push({ type: 'task', id: bugId });
    }
  }

  const stats = { deleted: 0, errors: [] };
  for (const artifact of artifacts.slice().reverse()) {
    try {
      await deleteTrackedArtifact(artifact);
      stats.deleted += 1;
    } catch (err) {
      stats.errors.push(`${artifact.type} ${artifact.id}: ${err.message}`);
    }
  }
  return stats;
}

/** Count residual QA-pattern rows (for verification scripts). */
async function countQaResiduals() {
  const [leads, contacts, tasks, users, finance, projects, notifications, qaUserIds, taskIds] = await Promise.all([
    Lead.countDocuments(buildQaTestDataFilter()).setOptions(BYPASS),
    Contact.countDocuments(buildQaTestDataFilter()).setOptions(BYPASS),
    Task.countDocuments(buildQaTaskFilter()).setOptions(BYPASS),
    User.countDocuments(buildQaUserFilter()).setOptions(BYPASS),
    FinanceDocument.countDocuments(buildQaFinanceFilter()).setOptions(BYPASS),
    Project.countDocuments(buildQaProjectFilter()).setOptions(BYPASS),
    Notification.countDocuments({ title: { $regex: /^QA /i } }).setOptions(BYPASS),
    collectQaUserIds(),
    collectQaTaskIds(),
  ]);
  const dailyLogs = await Log.countDocuments(buildQaDailyLogFilter({ taskIds, qaUserIds })).setOptions(BYPASS);
  return {
    leads,
    contacts,
    tasks,
    users,
    finance,
    projects,
    notifications,
    dailyLogs,
    total: leads + contacts + tasks + users + finance + projects + notifications + dailyLogs,
  };
}

module.exports = {
  isQaTestEmail,
  isQaTestRecord,
  buildQaTestDataFilter,
  buildQaUserFilter,
  buildQaTaskFilter,
  buildQaDailyLogFilter,
  buildQaActivityLogFilter,
  buildQaXpAuditFilter,
  buildDataHubExcludeFilter,
  purgeQaUsers,
  purgeQaTasks,
  purgeQaDailyLogs,
  purgeQaGamificationData,
  purgeQaTestData,
  purgeQaIdentity,
  qaUniquePhone,
  qaUniqueEmail,
  deleteTrackedArtifact,
  purgeQaRunArtifacts,
  countQaResiduals,
};
