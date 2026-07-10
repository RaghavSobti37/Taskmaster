#!/usr/bin/env node
/**
 * Reattach Raghav's legacy orphaned user references to the active Clerk user.
 *
 * Usage:
 *   node server/scripts/repairRaghavIdentityReferences.js --prod
 *   node server/scripts/repairRaghavIdentityReferences.js --prod --yes
 *   node server/scripts/repairRaghavIdentityReferences.js --prod --target-user-id=<id> --yes
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { resolveMongoUri, assertSafeDbTarget } = require('../config/database');
const { bypassOptions } = require('../infrastructure/database/bypassTenantPolicy');

const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Task = require('../models/Task');
const TaskAssignment = require('../models/TaskAssignment');
const Attendance = require('../models/Attendance');
const Log = require('../models/Log');
const Notification = require('../models/Notification');
const TaskActivity = require('../domains/tasks/models/TaskActivity');
const TaskMentionReceipt = require('../domains/tasks/models/TaskMentionReceipt');
const LeaveRequest = require('../models/LeaveRequest');
const XPAuditLog = require('../models/XPAuditLog');
const TenantMembership = require('../models/TenantMembership');
const DashboardPreset = require('../models/DashboardPreset');
const WorkspacePreference = require('../models/WorkspacePreference');
const ShortcutPreference = require('../models/ShortcutPreference');
const DailyMission = require('../models/DailyMission');
const MonthlyLeaderboardSnapshot = require('../models/MonthlyLeaderboardSnapshot');
const Project = require('../models/Project');
const Announcement = require('../models/Announcement');
const AuditEvent = require('../models/AuditEvent');
const SecurityAudit = require('../models/SecurityAudit');
const UserNote = require('../models/UserNote');
const PinBoardNote = require('../models/PinBoardNote');

const BYPASS = bypassOptions('RAGHAV_IDENTITY_REPAIR');
const LEGACY_USER_ID = '6a03b8ac51c059f0ec56d385';

const argv = process.argv.slice(2);
const dryRun = !argv.includes('--yes');
const useProd = argv.includes('--prod');
const argValue = (name) => {
  const prefix = `${name}=`;
  const hit = argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : '';
};

if (useProd) {
  process.env.MAIL_USE_PROD_DB = 'true';
  process.env.ALLOW_PROD_DB_IN_DEV = 'true';
}

const objectId = (value) => new mongoose.Types.ObjectId(String(value));
const legacyId = objectId(argValue('--legacy-user-id') || LEGACY_USER_ID);
let targetId = argValue('--target-user-id');

function result(name) {
  return { name, matched: 0, modified: 0, deleted: 0, merged: 0 };
}

async function countLegacyRefs(tenantId, id) {
  const idString = String(id);
  const counts = {};
  counts.tasksCreated = await Task.countDocuments({ tenantId, createdBy: id }).setOptions(BYPASS);
  counts.tasksMentionAccess = await Task.countDocuments({ tenantId, mentionAccessIds: id }).setOptions(BYPASS);
  counts.assignmentsUser = await TaskAssignment.countDocuments({ tenantId, userId: id }).setOptions(BYPASS);
  counts.assignmentsAssignedBy = await TaskAssignment.countDocuments({ tenantId, assignedBy: id }).setOptions(BYPASS);
  counts.attendance = await Attendance.countDocuments({
    tenantId,
    $or: [
      { userId: id },
      { createdBy: id },
      { 'inTimeRecord.approvedBy': id },
      { 'outTimeRecord.approvedBy': id },
    ],
  }).setOptions(BYPASS);
  counts.logs = await Log.countDocuments({ tenantId, $or: [{ userId: id }, { actorId: idString }] }).setOptions(BYPASS);
  counts.notifications = await Notification.countDocuments({ tenantId, $or: [{ recipient: id }, { actorId: id }] }).setOptions(BYPASS);
  counts.taskActivities = await TaskActivity.countDocuments({
    tenantId,
    $or: [{ actorId: id }, { assigneeId: id }, { assignedById: id }, { mentionedUserIds: id }],
  }).setOptions(BYPASS);
  counts.taskMentionReceipts = await TaskMentionReceipt.countDocuments({ tenantId, userId: id }).setOptions(BYPASS);
  counts.leaveRequests = await LeaveRequest.countDocuments({ tenantId, $or: [{ userId: id }, { reviewedBy: id }] }).setOptions(BYPASS);
  counts.xpAuditLogs = await XPAuditLog.countDocuments({ tenantId, userId: id }).setOptions(BYPASS);
  counts.tenantMemberships = await TenantMembership.countDocuments({ tenantId, userId: id });
  counts.dashboardPresets = await DashboardPreset.countDocuments({ tenantId, userId: id }).setOptions(BYPASS);
  counts.workspacePreferences = await WorkspacePreference.countDocuments({ tenantId, userId: id }).setOptions(BYPASS);
  counts.shortcutPreferences = await ShortcutPreference.countDocuments({ tenantId, userId: id }).setOptions(BYPASS);
  counts.dailyMissions = await DailyMission.countDocuments({ tenantId, userId: id }).setOptions(BYPASS);
  counts.monthlyLeaderboardSnapshots = await MonthlyLeaderboardSnapshot.countDocuments({ tenantId, 'entries.userId': id }).setOptions(BYPASS);
  counts.projects = await Project.countDocuments({
    tenantId,
    $or: [{ owner: id }, { members: id }, { 'memberRoles.user': id }, { 'linkedCalendars.userId': id }],
  }).setOptions(BYPASS);
  counts.announcements = await Announcement.countDocuments({ tenantId, $or: [{ createdBy: id }, { recipients: id }] }).setOptions(BYPASS);
  counts.auditEvents = await AuditEvent.countDocuments({ tenantId, actorId: id }).setOptions(BYPASS);
  counts.securityAudits = await SecurityAudit.countDocuments({ tenantId, actorId: id }).setOptions(BYPASS);
  counts.userNotes = await UserNote.countDocuments({ tenantId, userId: id }).setOptions(BYPASS);
  counts.pinBoardNotes = await PinBoardNote.countDocuments({ tenantId, createdBy: id }).setOptions(BYPASS);
  return counts;
}

async function updateMany(Model, name, filter, update, options = {}) {
  const out = result(name);
  out.matched = await Model.countDocuments(filter).setOptions?.(BYPASS) ?? await Model.countDocuments(filter);
  if (dryRun || out.matched === 0) return out;
  const query = Model.updateMany(filter, update, options).setOptions?.(BYPASS) ?? Model.updateMany(filter, update, options);
  const res = await query;
  out.modified = res.modifiedCount || 0;
  return out;
}

async function moveUniqueRows(Model, name, sourceFilter, targetKeyForRow, targetSet) {
  const out = result(name);
  const rows = await Model.find(sourceFilter).setOptions(BYPASS).lean();
  out.matched = rows.length;
  for (const row of rows) {
    const targetKey = targetKeyForRow(row);
    const existing = await Model.findOne(targetKey).setOptions(BYPASS).lean();
    if (dryRun) {
      if (existing) out.deleted += 1;
      else out.modified += 1;
      continue;
    }
    if (existing) {
      if (name === 'TaskMentionReceipt') {
        await Model.updateOne(
          { _id: existing._id },
          {
            $max: { unreadCount: row.unreadCount || 0, lastMentionAt: row.lastMentionAt || null },
            $set: { updatedAt: new Date() },
          },
        ).setOptions(BYPASS);
        out.merged += 1;
      }
      await Model.deleteOne({ _id: row._id }).setOptions(BYPASS);
      out.deleted += 1;
    } else {
      await Model.updateOne({ _id: row._id }, targetSet(row)).setOptions(BYPASS);
      out.modified += 1;
    }
  }
  return out;
}

async function repairArray(Model, name, field, tenantId, target) {
  const out = result(name);
  const filter = { tenantId, [field]: legacyId };
  out.matched = await Model.countDocuments(filter).setOptions(BYPASS);
  if (dryRun || out.matched === 0) return out;
  const add = {};
  const pull = {};
  add[field] = target;
  pull[field] = legacyId;
  // ponytail: Mongo rejects $addToSet + $pull on same path in one update.
  const addRes = await Model.updateMany(filter, { $addToSet: add }).setOptions(BYPASS);
  const pullRes = await Model.updateMany(filter, { $pull: pull }).setOptions(BYPASS);
  out.modified = Math.max(addRes.modifiedCount || 0, pullRes.modifiedCount || 0);
  return out;
}

async function main() {
  if (!useProd) {
    throw new Error('Pass --prod for this repair. Use dry-run without --yes first.');
  }

  const { dbUri, source } = resolveMongoUri();
  assertSafeDbTarget(dbUri, { source });
  await mongoose.connect(dbUri);

  const tenant = await Tenant.findOne({ slug: 'tsc' }).setOptions(BYPASS).lean();
  if (!tenant) throw new Error('Tenant slug tsc not found');

  if (!targetId) {
    const target = await User.findOne({
      tenantId: tenant._id,
      clerkId: { $exists: true, $nin: [null, ''] },
      $or: [{ email: /raghav/i }, { name: /raghav|sobti/i }],
    }).setOptions(BYPASS).select('_id name email clerkId').lean();
    if (!target) throw new Error('Active Clerk Raghav user not found. Pass --target-user-id.');
    targetId = String(target._id);
  }
  const target = objectId(targetId);
  const targetUser = await User.findOne({ _id: target, tenantId: tenant._id }).setOptions(BYPASS).select('_id name email clerkId').lean();
  if (!targetUser) throw new Error(`Target user not found in tsc tenant: ${targetId}`);
  if (!targetUser.clerkId) throw new Error(`Target user has no Clerk id: ${targetId}`);

  const before = await countLegacyRefs(tenant._id, legacyId);
  const operations = [];

  operations.push(await updateMany(Task, 'Task.createdBy', { tenantId: tenant._id, createdBy: legacyId }, { $set: { createdBy: target } }));
  operations.push(await repairArray(Task, 'Task.mentionAccessIds', 'mentionAccessIds', tenant._id, target));

  operations.push(await moveUniqueRows(
    TaskAssignment,
    'TaskAssignment.userId',
    { tenantId: tenant._id, userId: legacyId },
    (row) => ({ tenantId: tenant._id, taskId: row.taskId, userId: target }),
    () => ({ $set: { userId: target } }),
  ));
  operations.push(await updateMany(TaskAssignment, 'TaskAssignment.assignedBy', { tenantId: tenant._id, assignedBy: legacyId }, { $set: { assignedBy: target } }));

  operations.push(await updateMany(Attendance, 'Attendance.userId', { tenantId: tenant._id, userId: legacyId }, { $set: { userId: target, username: targetUser.name } }));
  operations.push(await updateMany(Attendance, 'Attendance.createdBy', { tenantId: tenant._id, createdBy: legacyId }, { $set: { createdBy: target } }));
  operations.push(await updateMany(Attendance, 'Attendance.inApprovedBy', { tenantId: tenant._id, 'inTimeRecord.approvedBy': legacyId }, { $set: { 'inTimeRecord.approvedBy': target } }));
  operations.push(await updateMany(Attendance, 'Attendance.outApprovedBy', { tenantId: tenant._id, 'outTimeRecord.approvedBy': legacyId }, { $set: { 'outTimeRecord.approvedBy': target } }));

  operations.push(await updateMany(Log, 'Log.userId', { tenantId: tenant._id, userId: legacyId }, { $set: { userId: target } }));
  operations.push(await updateMany(Log, 'Log.actorId', { tenantId: tenant._id, actorId: String(legacyId) }, { $set: { actorId: String(target) } }));

  operations.push(await updateMany(Notification, 'Notification.recipient', { tenantId: tenant._id, recipient: legacyId }, { $set: { recipient: target } }));
  operations.push(await updateMany(Notification, 'Notification.actorId', { tenantId: tenant._id, actorId: legacyId }, { $set: { actorId: target } }));

  operations.push(await updateMany(TaskActivity, 'TaskActivity.actorId', { tenantId: tenant._id, actorId: legacyId }, { $set: { actorId: target } }));
  operations.push(await updateMany(TaskActivity, 'TaskActivity.assigneeId', { tenantId: tenant._id, assigneeId: legacyId }, { $set: { assigneeId: target } }));
  operations.push(await updateMany(TaskActivity, 'TaskActivity.assignedById', { tenantId: tenant._id, assignedById: legacyId }, { $set: { assignedById: target } }));
  operations.push(await repairArray(TaskActivity, 'TaskActivity.mentionedUserIds', 'mentionedUserIds', tenant._id, target));

  operations.push(await moveUniqueRows(
    TaskMentionReceipt,
    'TaskMentionReceipt',
    { tenantId: tenant._id, userId: legacyId },
    (row) => ({ tenantId: tenant._id, taskId: row.taskId, userId: target }),
    () => ({ $set: { userId: target } }),
  ));

  operations.push(await updateMany(LeaveRequest, 'LeaveRequest.userId', { tenantId: tenant._id, userId: legacyId }, { $set: { userId: target, username: targetUser.name } }));
  operations.push(await updateMany(LeaveRequest, 'LeaveRequest.reviewedBy', { tenantId: tenant._id, reviewedBy: legacyId }, { $set: { reviewedBy: target } }));
  operations.push(await updateMany(XPAuditLog, 'XPAuditLog.userId', { tenantId: tenant._id, userId: legacyId }, { $set: { userId: target } }));

  operations.push(await moveUniqueRows(
    TenantMembership,
    'TenantMembership',
    { tenantId: tenant._id, userId: legacyId },
    () => ({ tenantId: tenant._id, userId: target }),
    () => ({ $set: { userId: target } }),
  ));
  operations.push(await moveUniqueRows(
    DashboardPreset,
    'DashboardPreset',
    { tenantId: tenant._id, userId: legacyId },
    () => ({ tenantId: tenant._id, userId: target }),
    () => ({ $set: { userId: target, updatedAt: new Date() } }),
  ));
  operations.push(await moveUniqueRows(
    WorkspacePreference,
    'WorkspacePreference',
    { tenantId: tenant._id, userId: legacyId },
    () => ({ tenantId: tenant._id, userId: target }),
    () => ({ $set: { userId: target, updatedAt: new Date() } }),
  ));
  operations.push(await moveUniqueRows(
    ShortcutPreference,
    'ShortcutPreference',
    { tenantId: tenant._id, userId: legacyId },
    () => ({ tenantId: tenant._id, userId: target }),
    () => ({ $set: { userId: target, updatedAt: new Date() } }),
  ));

  operations.push(await updateMany(DailyMission, 'DailyMission.userId', { tenantId: tenant._id, userId: legacyId }, { $set: { userId: target } }));
  operations.push(await updateMany(
    MonthlyLeaderboardSnapshot,
    'MonthlyLeaderboardSnapshot.entries.userId',
    { tenantId: tenant._id, 'entries.userId': legacyId },
    { $set: { 'entries.$[entry].userId': target, 'entries.$[entry].name': targetUser.name, 'entries.$[entry].avatar': targetUser.avatar || '' } },
    { arrayFilters: [{ 'entry.userId': legacyId }] },
  ));

  operations.push(await updateMany(Project, 'Project.owner', { tenantId: tenant._id, owner: legacyId }, { $set: { owner: target } }));
  operations.push(await repairArray(Project, 'Project.members', 'members', tenant._id, target));
  operations.push(await updateMany(Project, 'Project.memberRoles.user', { tenantId: tenant._id, 'memberRoles.user': legacyId }, { $set: { 'memberRoles.$[role].user': target } }, { arrayFilters: [{ 'role.user': legacyId }] }));
  operations.push(await updateMany(Project, 'Project.linkedCalendars.userId', { tenantId: tenant._id, 'linkedCalendars.userId': legacyId }, { $set: { 'linkedCalendars.$[cal].userId': target } }, { arrayFilters: [{ 'cal.userId': legacyId }] }));

  operations.push(await updateMany(Announcement, 'Announcement.createdBy', { tenantId: tenant._id, createdBy: legacyId }, { $set: { createdBy: target } }));
  operations.push(await repairArray(Announcement, 'Announcement.recipients', 'recipients', tenant._id, target));
  operations.push(await updateMany(AuditEvent, 'AuditEvent.actorId', { tenantId: tenant._id, actorId: legacyId }, { $set: { actorId: target } }));
  operations.push(await updateMany(SecurityAudit, 'SecurityAudit.actorId', { tenantId: tenant._id, actorId: legacyId }, { $set: { actorId: target } }));
  operations.push(await updateMany(UserNote, 'UserNote.userId', { tenantId: tenant._id, userId: legacyId }, { $set: { userId: target } }));
  operations.push(await updateMany(PinBoardNote, 'PinBoardNote.createdBy', { tenantId: tenant._id, createdBy: legacyId }, { $set: { createdBy: target } }));

  const after = dryRun ? null : await countLegacyRefs(tenant._id, legacyId);
  const targetAfter = dryRun ? null : await countLegacyRefs(tenant._id, target);

  console.log(JSON.stringify({
    dryRun,
    tenantId: String(tenant._id),
    legacyUserId: String(legacyId),
    targetUser: {
      id: String(targetUser._id),
      name: targetUser.name,
      email: targetUser.email,
      hasClerk: Boolean(targetUser.clerkId),
    },
    before,
    operations,
    after,
    targetAfter,
  }, null, 2));

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
