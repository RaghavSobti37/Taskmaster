const mongoose = require('mongoose');
const CRMAudit = require('../models/CRMAudit');
const User = require('../../../models/User');
const { getDepartmentSlug } = require('../../../utils/departmentPermissions');

async function populateAuditUsers(logs) {
  const userIds = [...new Set(logs.map((log) => log.userId).filter((id) => id && mongoose.isValidObjectId(id)))];
  const users = await User.find({ _id: { $in: userIds } }, 'name email avatar').lean();
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  return logs.map((log) => {
    const userIdStr = log.userId ? log.userId.toString() : '';
    if (userMap.has(userIdStr)) {
      log.userId = userMap.get(userIdStr);
    } else {
      log.userId = { name: log.userId || 'System / Batch' };
    }
    return log;
  });
}

async function getAuditLogsForLead(leadId) {
  const logs = await CRMAudit.find({ leadId })
    .sort('-timestamp')
    .lean();
  return populateAuditUsers(logs);
}

async function getAllAuditLogs(queryParams = {}) {
  const query = {};
  if (queryParams.userId) {
    query.userId = queryParams.userId;
  }
  const limit = parseInt(queryParams.limit, 10) || 100;
  const page = parseInt(queryParams.page, 10) || 1;
  const skip = (page - 1) * limit;

  const logs = await CRMAudit.find(query)
    .populate('leadId', 'name email phone')
    .sort('-timestamp')
    .skip(skip)
    .limit(limit)
    .lean();

  const populated = await populateAuditUsers(logs);
  const total = await CRMAudit.countDocuments(query);

  return {
    logs: populated,
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}

async function getPurgeLogs() {
  return CRMAudit.find({ action: { $in: ['BATCH_DELETE', 'SYSTEM_RESET'] } })
    .populate('userId', 'name')
    .sort('-createdAt');
}

async function purgeAuditLogs() {
  await CRMAudit.deleteMany({});
  return { message: 'All lead change audit logs have been purged.' };
}

async function logLeadDeletion(lead, userId) {
  await CRMAudit.create({
    leadId: lead._id,
    userId,
    fieldChanged: '__deleted__',
    oldValue: lead.name,
    newValue: null,
    timestamp: new Date(),
  });
}

async function logNoteAdded(leadId, user, text) {
  await CRMAudit.create({
    leadId,
    userId: user._id,
    userRole: getDepartmentSlug(user),
    fieldChanged: 'notes',
    oldValue: '',
    newValue: `Note added: "${text.trim()}"`,
    timestamp: new Date(),
  });
}

async function logSystemReset(user, reason) {
  await CRMAudit.create({
    userId: user._id,
    userRole: getDepartmentSlug(user),
    action: 'SYSTEM_RESET',
    fieldChanged: 'all',
    oldValue: 'active',
    newValue: 'purged',
    notes: reason || 'System-wide data reset protocol executed.',
  });
}

async function logProjectDeletion(user, project) {
  await CRMAudit.create({
    userId: user._id,
    userRole: getDepartmentSlug(user),
    action: 'PROJECT_DELETE',
    fieldChanged: 'project',
    oldValue: project.name,
    newValue: 'PURGED',
    notes: `Project ${project.name} decommissioned by root administrator.`,
  });
}

module.exports = {
  populateAuditUsers,
  getAuditLogsForLead,
  getAllAuditLogs,
  getPurgeLogs,
  purgeAuditLogs,
  logLeadDeletion,
  logNoteAdded,
  logSystemReset,
  logProjectDeletion,
};
