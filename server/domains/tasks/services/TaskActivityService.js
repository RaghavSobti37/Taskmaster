const Task = require('../models/Task');
const TaskAssignment = require('../models/TaskAssignment');
const TaskActivity = require('../models/TaskActivity');
const TaskMentionReceipt = require('../models/TaskMentionReceipt');
const Project = require('../../../models/Project');
const User = require('../../../models/User');
const { sanitizeName } = require('../../../utils/sanitizer');
const { buildMentionNotifications, resolveNewlyMentionedUserIds } = require('../../../utils/mentionNotifications');
const { buildTaskActionUrl } = require('../../../utils/notificationActionUrl');
const { extractUserMentionLabels, resolveUserByLabel } = require('../../../../shared/mentionTokens');
const { isAdminUser } = require('../../../utils/departmentPermissions');
const { userHasTaskScopeAccess } = require('../../../utils/taskAccess');
const { resolveMentionedUserIds } = require('../../../utils/mentionNotifications');
const { publishTaskActivity } = require('./taskSyncEvents');

const assignmentUserId = (value) => (value?._id || value)?.toString?.() || null;

const emitActivities = (rows) => {
  const list = Array.isArray(rows) ? rows : [rows];
  for (const row of list) {
    if (row) publishTaskActivity(row);
  }
};

const createActivities = async (docs, options = {}) => {
  const created = await TaskActivity.create(docs, options);
  emitActivities(created);
  return created;
};

const insertActivities = async (docs, options = {}) => {
  const created = await TaskActivity.insertMany(docs, options);
  emitActivities(created);
  return created;
};

const getProjectRole = (project, userId) => {
  if (!project || !userId) return null;
  const uid = userId.toString();
  const ownerId = (project.owner?._id || project.owner)?.toString?.();
  if (ownerId && ownerId === uid) return 'admin';
  const isMember = project.members?.some((m) => (m?._id || m)?.toString() === uid);
  if (!isMember) return null;
  const { getProjectRoleForUser } = require('../../../../shared/projectRoles');
  return getProjectRoleForUser(project, userId);
};

const userHasProjectAccess = (project, userId) => Boolean(getProjectRole(project, userId));

const resolveMentionedUserIdsFromActivity = async (taskId) => {
  const rows = await TaskActivity.find({ taskId, type: 'message' }).select('body').lean();
  const labels = rows.flatMap((r) => extractUserMentionLabels(r.body || ''));
  if (!labels.length) return new Set();

  const users = await User.find({}).select('name email').lean();
  const ids = new Set();
  for (const label of labels) {
    const mentioned = resolveUserByLabel(label, users);
    if (mentioned?._id) ids.add(mentioned._id.toString());
  }
  return ids;
};

const resolveAllMentionedUserIdsForTask = async (task) => {
  const fromFields = await resolveMentionedUserIds(task.title, task.description);
  const fromActivity = await resolveMentionedUserIdsFromActivity(task._id);
  return new Set([...fromFields, ...fromActivity]);
};

const resolveMentionedUserIdsFromText = async (text) => {
  const labels = extractUserMentionLabels(text || '');
  if (!labels.length) return [];

  const users = await User.find({}).select('name email').lean();
  const ids = [];
  const seen = new Set();
  for (const label of labels) {
    const mentioned = resolveUserByLabel(label, users);
    if (!mentioned?._id) continue;
    const id = mentioned._id.toString();
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(mentioned._id);
  }
  return ids;
};

const canAccessTaskActivity = async (task, user) => {
  if (!task || !user?._id) return false;
  if (isAdminUser(user)) return true;

  const uid = user._id.toString();
  if (task.createdBy?.toString() === uid) return true;

  const assignment = await TaskAssignment.findOne({ taskId: task._id, userId: user._id }).lean();
  if (assignment) return true;

  if (task.projectId) {
    const project = await Project.findById(task.projectId).lean();
    if (project && userHasProjectAccess(project, user._id)) return true;
  }

  if ((task.mentionAccessIds || []).some((id) => (id?._id || id)?.toString() === uid)) {
    return true;
  }

  const mentionedUserIds = await resolveAllMentionedUserIdsForTask(task);
  if (mentionedUserIds.has(uid)) {
    return userHasTaskScopeAccess(task, uid);
  }

  return false;
};

const mapActivityRow = (row) => ({
  _id: row._id,
  type: row.type,
  body: row.body || '',
  createdAt: row.createdAt,
  actor: row.actorId
    ? { _id: row.actorId._id || row.actorId, name: row.actorId.name, avatar: row.actorId.avatar }
    : null,
  assignee: row.assigneeId
    ? { _id: row.assigneeId._id || row.assigneeId, name: row.assigneeId.name, avatar: row.assigneeId.avatar }
    : null,
  assignedBy: row.assignedById
    ? { _id: row.assignedById._id || row.assignedById, name: row.assignedById.name, avatar: row.assignedById.avatar }
    : null,
  mentionedUserIds: (row.mentionedUserIds || []).map((id) => id?.toString?.() || id),
  statusFrom: row.statusFrom || null,
  statusTo: row.statusTo || null,
  fieldKey: row.fieldKey || null,
  valueFrom: row.valueFrom ?? null,
  valueTo: row.valueTo ?? null,
});

const toActivityDateKey = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const normalizeFieldValue = (fieldKey, value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  switch (fieldKey) {
    case 'category':
      return raw.toLowerCase();
    case 'slot':
      return raw.toUpperCase();
    case 'scheduleDate':
    case 'dueDate':
      return toActivityDateKey(value) || raw;
    default:
      return raw;
  }
};

const recordFieldChange = async (taskId, actor, fieldKey, valueFrom, valueTo, session) => {
  const key = String(fieldKey || '').trim();
  if (!key) return;
  const from = normalizeFieldValue(key, valueFrom);
  const to = normalizeFieldValue(key, valueTo);
  if (!to || from === to) return;

  await createActivities(
    [{
      taskId,
      type: 'field_change',
      body: '',
      actorId: actor._id,
      fieldKey: key,
      valueFrom: from,
      valueTo: to,
    }],
    { session }
  );
};

const recordFieldChangesFromTask = async (existing, task, actor, coreUpdates, session) => {
  if (!task?._id || !actor?._id) return;

  const specs = [
    {
      key: 'category',
      touched: coreUpdates.type !== undefined,
      from: existing.type,
      to: task.type,
    },
    {
      key: 'slot',
      touched: coreUpdates.scheduleSlot !== undefined,
      from: existing.scheduleSlot,
      to: task.scheduleSlot,
    },
    {
      key: 'scheduleDate',
      touched: coreUpdates.scheduleDate !== undefined,
      from: existing.scheduleDate,
      to: task.scheduleDate,
    },
    {
      key: 'dueDate',
      touched: coreUpdates.dueDate !== undefined,
      from: existing.dueDate,
      to: task.dueDate,
    },
  ];

  for (const spec of specs) {
    if (!spec.touched) continue;
    await recordFieldChange(task._id, actor, spec.key, spec.from, spec.to, session);
  }
};

const recordStatusChange = async (taskId, actor, statusFrom, statusTo, session) => {
  const from = String(statusFrom || '').toLowerCase();
  const to = String(statusTo || '').toLowerCase();
  if (!to || from === to) return;

  await createActivities(
    [{
      taskId,
      type: 'status_change',
      body: '',
      actorId: actor._id,
      statusFrom: from,
      statusTo: to,
    }],
    { session }
  );
};

const recordRollback = async (taskId, actor, reason, statusFrom, session) => {
  const body = normalizeMessageBody(reason);
  if (!body) return;

  await createActivities(
    [{
      taskId,
      type: 'rollback',
      body,
      actorId: actor._id,
      statusFrom: String(statusFrom || '').toLowerCase(),
      statusTo: 'in-progress',
    }],
    { session }
  );
};

const normalizeMessageBody = (body) => sanitizeName(String(body || '').trim());

const seedCreatedAndAssignments = async (task, assignments, actor, session) => {
  const actorId = actor._id;
  const rows = [
    {
      taskId: task._id,
      type: 'created',
      body: '',
      actorId,
    },
  ];

  const initialMessage = normalizeMessageBody(task.description);
  if (initialMessage) {
    const mentionedUserIds = await resolveMentionedUserIdsFromText(initialMessage);
    rows.push({
      taskId: task._id,
      type: 'message',
      body: initialMessage,
      actorId,
      mentionedUserIds,
    });
  }

  for (const a of assignments || []) {
    const assigneeId = a.userId?._id || a.userId;
    const assignedById = a.assignedBy?._id || a.assignedBy || actorId;
    if (!assigneeId) continue;
    rows.push({
      taskId: task._id,
      type: 'assignment',
      body: '',
      actorId: assignedById,
      assigneeId,
      assignedById,
    });
  }

  await insertActivities(rows, { session });
};

const recordAssignmentChanges = async (taskId, oldAssignments, newAssignments, actor, session) => {
  const oldSet = new Set(
    (oldAssignments || []).map((a) => assignmentUserId(a.userId)).filter(Boolean)
  );
  const rows = [];

  for (const a of newAssignments || []) {
    const assigneeId = a.userId?._id || a.userId;
    const uid = assignmentUserId(assigneeId);
    if (!uid || oldSet.has(uid)) continue;

    const assignedById = a.assignedBy?._id || a.assignedBy || actor._id;
    rows.push({
      taskId,
      type: 'assignment',
      body: '',
      actorId: assignedById,
      assigneeId,
      assignedById,
    });
  }

  if (rows.length) {
    await insertActivities(rows, { session });
  }
};

const listActivity = async (taskId, user, { markRead = false } = {}) => {
  const task = await Task.findById(taskId)
    .populate('createdBy', 'name avatar')
    .lean();
  if (!task) throw new Error('Task not found');

  const allowed = await canAccessTaskActivity(task, user);
  if (!allowed) throw new Error('Not authorized to view task activity');

  if (markRead) {
    await markMentionsRead(taskId, user._id);
  }

  const rows = await TaskActivity.find({ taskId })
    .sort({ createdAt: -1 })
    .populate('actorId', 'name avatar')
    .populate('assigneeId', 'name avatar')
    .populate('assignedById', 'name avatar')
    .lean();

  const mapped = rows.map(mapActivityRow);
  const hasCreated = mapped.some((row) => row.type === 'created');
  if (!hasCreated && task.createdAt) {
    const creator = task.createdBy;
    const actor = creator && typeof creator === 'object'
      ? { _id: creator._id, name: creator.name, avatar: creator.avatar }
      : null;
    mapped.push({
      _id: `synthetic-created-${taskId}`,
      type: 'created',
      body: '',
      createdAt: task.createdAt,
      actor,
      assignee: null,
      assignedBy: null,
      mentionedUserIds: [],
      statusFrom: null,
      statusTo: null,
      fieldKey: null,
      valueFrom: null,
      valueTo: null,
    });
    mapped.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  return mapped;
};

const bumpMentionReceipts = async (taskId, recipientIds, actorId, session) => {
  const actorStr = actorId?.toString?.();
  const now = new Date();
  const { isQaProbeActive } = require('../../../utils/qaProbeContext');
  const { isQaExcludedUserId } = require('../../../utils/qaExcludedUsers');
  const qaActive = isQaProbeActive();

  for (const recipientId of recipientIds) {
    const rid = recipientId?.toString?.() || recipientId;
    if (!rid || rid === actorStr) continue;
    if (qaActive && (await isQaExcludedUserId(rid))) continue;

    await TaskMentionReceipt.findOneAndUpdate(
      { userId: rid, taskId },
      {
        $inc: { unreadCount: 1 },
        $set: { lastMentionAt: now },
      },
      { upsert: true, session, new: true }
    );
  }
};

const appendTaskMessage = async ({
  task,
  user,
  body,
  previousBody = '',
  session,
  requireChange = true,
}) => {
  if (!task?._id || !user?._id) {
    return { activity: null, mentionPayloads: [], assignNotifications: [] };
  }

  if (task.status === 'done') {
    throw new Error('Cannot post messages on completed tasks');
  }

  const sanitized = normalizeMessageBody(body);
  const previous = normalizeMessageBody(previousBody);
  if (!sanitized) return { activity: null, mentionPayloads: [], assignNotifications: [] };
  if (requireChange && sanitized === previous) {
    return { activity: null, mentionPayloads: [], assignNotifications: [] };
  }

  const mentionedUserIds = await resolveMentionedUserIdsFromText(sanitized);

  const [activity] = await createActivities(
    [{
      taskId: task._id,
      type: 'message',
      body: sanitized,
      actorId: user._id,
      mentionedUserIds,
    }],
    { session }
  );

  const assigneeRows = await TaskAssignment.find({ taskId: task._id }).select('userId').session(session).lean();
  const assigneeIds = assigneeRows.map((a) => a.userId?.toString()).filter(Boolean);

  await bumpMentionReceipts(task._id, mentionedUserIds, user._id, session);

  const newlyMentioned = await resolveNewlyMentionedUserIds(sanitized, previousBody || '');
  const TaskService = require('./TaskService');
  const { pendingNotifications: assignNotifications } = await TaskService.addMentionedUsersAsAssignees({
    taskId: task._id,
    mentionedUserIds: newlyMentioned,
    user,
    session,
  });

  const mentionPayloads = await buildMentionNotifications({
    text: sanitized,
    previousText: previousBody || '',
    actor: user,
    assigneeIds: [...new Set([...assigneeIds, ...newlyMentioned])],
    task,
    source: 'thread',
  });

  const populated = await TaskActivity.findById(activity._id)
    .session(session)
    .populate('actorId', 'name avatar')
    .lean();

  return { activity: mapActivityRow(populated), mentionPayloads, assignNotifications };
};

const postMessage = async (taskId, user, body, session) => {
  const task = await Task.findById(taskId).session(session);
  if (!task) throw new Error('Task not found');

  const allowed = await canAccessTaskActivity(task, user);
  if (!allowed) throw new Error('Not authorized to post on this task');

  const sanitized = normalizeMessageBody(body);
  if (!sanitized) throw new Error('Message cannot be empty');

  return appendTaskMessage({
    task,
    user,
    body: sanitized,
    previousBody: '',
    session,
    requireChange: false,
  });
};

const markMentionsRead = async (taskId, userId) => {
  await TaskMentionReceipt.findOneAndUpdate(
    { userId, taskId },
    { $set: { unreadCount: 0 } }
  );
};

const getUnreadMentionCountsByTask = async (userId, taskIds) => {
  if (!userId || !taskIds?.length) return {};

  const receipts = await TaskMentionReceipt.find({
    userId,
    taskId: { $in: taskIds },
    unreadCount: { $gt: 0 },
  })
    .select('taskId unreadCount')
    .lean();

  return receipts.reduce((acc, r) => {
    acc[r.taskId.toString()] = r.unreadCount;
    return acc;
  }, {});
};

const purgeActivityForTasks = async (taskIds) => {
  if (!taskIds?.length) return { activities: 0, receipts: 0 };
  const ids = taskIds.map((id) => id?.toString?.() || id).filter(Boolean);

  const [actResult, receiptResult] = await Promise.all([
    TaskActivity.deleteMany({ taskId: { $in: ids } }),
    TaskMentionReceipt.deleteMany({ taskId: { $in: ids } }),
  ]);

  return {
    activities: actResult.deletedCount || 0,
    receipts: receiptResult.deletedCount || 0,
  };
};

const getTaskById = async (taskId, user) => {
  const { mapTaskDTO } = require('./TaskService');
  const task = await Task.findById(taskId)
    .populate('projectId', 'name workspace')
    .populate('createdBy', 'name avatar')
    .populate(require('./TaskService').TASK_ASSIGNEE_POPULATE);

  if (!task) throw new Error('Task not found');

  const allowed = await canAccessTaskActivity(task, user);
  if (!allowed) throw new Error('Not authorized to view this task');

  const dto = mapTaskDTO(task);
  const unreadMap = await getUnreadMentionCountsByTask(user._id, [task._id]);
  dto.unreadMentions = unreadMap[task._id.toString()] || 0;
  return dto;
};

module.exports = {
  canAccessTaskActivity,
  seedCreatedAndAssignments,
  recordAssignmentChanges,
  recordStatusChange,
  recordRollback,
  recordFieldChange,
  recordFieldChangesFromTask,
  listActivity,
  appendTaskMessage,
  postMessage,
  bumpMentionReceipts,
  resolveMentionedUserIdsFromText,
  markMentionsRead,
  getUnreadMentionCountsByTask,
  purgeActivityForTasks,
  getTaskById,
  resolveAllMentionedUserIdsForTask,
};
