/**
 * Database snapshot before QA run + residual compare after cleanup.
 */
const Lead = require('../../models/Lead');
const Contact = require('../../models/Contact');
const Task = require('../../models/Task');
const User = require('../../models/User');
const FinanceDocument = require('../../models/FinanceDocument');
const Project = require('../../models/Project');
const Notification = require('../../models/Notification');
const Log = require('../../models/Log');
const CRMAudit = require('../../models/CRMAudit');
const XPAuditLog = require('../../models/XPAuditLog');
const {
  buildQaTestDataFilter,
  buildQaUserFilter,
  buildQaTaskFilter,
  buildQaFinanceFilter,
  buildQaProjectFilter,
  buildQaDailyLogFilter,
  buildQaActivityLogFilter,
  countQaResiduals,
} = require('./qaTestData');

const BYPASS = { bypassTenant: true };

async function takeDbSnapshot() {
  const [qaLeads, qaContacts, qaTasks, qaUsers, qaFinance, qaProjects, qaNotifications] = await Promise.all([
    Lead.countDocuments(buildQaTestDataFilter()).setOptions(BYPASS),
    Contact.countDocuments(buildQaTestDataFilter()).setOptions(BYPASS),
    Task.countDocuments(buildQaTaskFilter()).setOptions(BYPASS),
    User.countDocuments(buildQaUserFilter()).setOptions(BYPASS),
    FinanceDocument.countDocuments(buildQaFinanceFilter()).setOptions(BYPASS),
    Project.countDocuments(buildQaProjectFilter()).setOptions(BYPASS),
    Notification.countDocuments({ title: { $regex: /^QA /i } }).setOptions(BYPASS),
  ]);

  const qaUserIds = (await User.find(buildQaUserFilter()).setOptions(BYPASS).select('_id').lean()).map((u) => u._id);
  const taskIds = (await Task.find(buildQaTaskFilter()).setOptions(BYPASS).select('_id').lean()).map((t) => t._id);

  const leadIds = (await Lead.find(buildQaTestDataFilter()).setOptions(BYPASS).select('_id').lean()).map((l) => l._id);
  const [qaDailyLogs, qaActivityLogs, qaAudits, qaXpAudits] = await Promise.all([
    Log.countDocuments(buildQaDailyLogFilter({ taskIds, qaUserIds })).setOptions(BYPASS),
    Log.countDocuments(buildQaActivityLogFilter()).setOptions(BYPASS),
    leadIds.length ? CRMAudit.countDocuments({ leadId: { $in: leadIds } }).setOptions(BYPASS) : 0,
    XPAuditLog.countDocuments({ 'details.qaProbe': true }).catch(() => 0),
  ]);

  const totals = {
    leads: qaLeads,
    contacts: qaContacts,
    tasks: qaTasks,
    users: qaUsers,
    finance: qaFinance,
    projects: qaProjects,
    notifications: qaNotifications,
    dailyLogs: qaDailyLogs,
    activityLogs: qaActivityLogs,
    audits: qaAudits,
    xpAudits: qaXpAudits,
  };
  totals.total = Object.values(totals).reduce((s, n) => s + (typeof n === 'number' ? n : 0), 0);

  return {
    capturedAt: new Date(),
    counts: totals,
  };
}

async function compareSnapshotAfterCleanup(beforeSnapshot, cleanupResults = {}) {
  const after = await countQaResiduals();
  const before = beforeSnapshot?.counts || {};

  const delta = {
    leads: after.leads - (before.leads || 0),
    contacts: after.contacts - (before.contacts || 0),
    tasks: after.tasks - (before.tasks || 0),
    users: after.users - (before.users || 0),
    finance: after.finance - (before.finance || 0),
    projects: after.projects - (before.projects || 0),
    notifications: after.notifications - (before.notifications || 0),
    dailyLogs: after.dailyLogs - (before.dailyLogs || 0),
  };

  const created = cleanupResults?.created || {};
  const deleted = cleanupResults?.deleted || cleanupResults || {};

  const passed = after.total === 0;
  return {
    passed,
    before: beforeSnapshot?.counts,
    after,
    delta,
    created,
    deleted,
    failReason: passed ? null : `Residual QA artifacts: ${after.total} rows remain`,
    verifiedAt: new Date(),
  };
}

module.exports = {
  takeDbSnapshot,
  compareSnapshotAfterCleanup,
  countQaResiduals,
};
