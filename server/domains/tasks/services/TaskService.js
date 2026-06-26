const mongoose = require('mongoose');
const Task = require('../models/Task');
const TaskAssignment = require('../models/TaskAssignment');
const Project = require('../../../models/Project');
const Log = require('../../../models/Log');
const logActivity = require('../../../utils/activityLogger');
const { applyPriorityDueDate } = require('../../../../shared/taskPriorityDates');
const { getProjectRoleForUser, userIsProjectViewer } = require('../../../../shared/projectRoles');
const {
  requiresReviewForUser,
  needsReviewOnComplete,
  getReviewQueueAssignmentFilter,
  canUserApproveReview,
  canUserApproveOrRollback,
  canUserRollbackTask,
  filterReviewQueueTasks,
  normalizeAssigneeIds,
  getAssignmentForUser,
  getDelegatedAssignments,
  assignmentAssignerId,
  assignmentUserId: rulesAssignmentUserId,
  normalizeId: rulesNormalizeId,
  isAssignerOnlyReviewer,
  REVIEW_DEFAULT_HOURS,
  REVIEW_LOG_LABEL,
} = require('../../../../shared/taskReviewRules');
const { resolvePlatformOwnerUser } = require('../../../utils/platformOwner');
const { formatTimeSpent, MIN_COMPLETION_MINUTES } = require('../../../../shared/timeSpent');
const { refreshAttendanceMetricsForUserDay } = require('../../../utils/refreshAttendanceMetrics');
const { clampXpHours } = require('../../../../shared/gamificationRules');
const syncDualWrite = require('../../../services/syncDualWrite');
const { queueGamificationEvent } = require('../../../services/backgroundQueue');
const { buildTaskActionUrl } = require('../../../utils/notificationActionUrl');
const {
  buildMentionNotifications,
  resolveMentionedUserIds,
  resolveNewlyMentionedUserIds,
  isMentionOnlyUser,
} = require('../../../utils/mentionNotifications');
const { isAdminUser } = require('../../../utils/departmentPermissions');
const { validateTaskTimelineForRequest } = require('../../../utils/dateValidation');
const {
  normalizeAssigneeIds: normalizeTaskAssigneeIds,
  filterUserIdsByTaskScope,
  assertAssigneesAreTenantUsers,
  syncMentionAccessIds,
  userHasTaskScopeAccess,
} = require('../../../utils/taskAccess');
const { isQaSyncGamification } = require('../../../utils/qaProbeContext');
const {
  publishTaskCreated,
  publishTaskUpdated,
  publishTaskDeleted,
} = require('./taskSyncEvents');
const {
  getTaskListCountsCache,
  setTaskListCountsCache,
} = require('../../../services/hybridCache');
const { bypassOptions } = require('../../../infrastructure/database/bypassTenantPolicy');

const assignmentUserId = (value) => (value?._id || value)?.toString?.() || null;

/** taskId is authoritative — clear all rows before replace (legacy rows may lack tenantId). */
const TASK_ASSIGNMENT_BYPASS = bypassOptions('task-assignment-sync-by-taskId');

const findTaskAssignments = (taskId, session) => {
  let q = TaskAssignment.find({ taskId }).setOptions(TASK_ASSIGNMENT_BYPASS);
  if (session) q = q.session(session);
  return q.lean();
};

const replaceTaskAssignments = async (taskId, assignmentDocs, session) => {
  await TaskAssignment.deleteMany({ taskId }, { session }).setOptions(TASK_ASSIGNMENT_BYPASS);
  if (assignmentDocs?.length) {
    await TaskAssignment.insertMany(assignmentDocs, { session });
  }
};

const TASK_ASSIGNEE_POPULATE = {
  path: 'assignees',
  populate: [
    {
      path: 'userId',
      select: 'name avatar departmentId',
      populate: { path: 'departmentId', select: 'name slug' },
    },
    {
      path: 'assignedBy',
      select: 'name avatar departmentId',
      populate: { path: 'departmentId', select: 'name slug' },
    },
  ],
};

exports.TASK_ASSIGNEE_POPULATE = TASK_ASSIGNEE_POPULATE;

/** Lighter populate for list views (Todo, dashboard) — skips department nesting. */
const TASK_LIST_ASSIGNEE_POPULATE = {
  path: 'assignees',
  populate: [
    { path: 'userId', select: 'name avatar' },
    { path: 'assignedBy', select: 'name avatar' },
  ],
};

exports.TASK_LIST_ASSIGNEE_POPULATE = TASK_LIST_ASSIGNEE_POPULATE;

const queueTaskCompletedGamification = async (userId, task) => {
  if (!userId || !task?._id) return;
  const job = queueGamificationEvent('TASK_COMPLETED', {
    userId,
    task: {
      _id: task._id,
      title: task.title,
      projectId: task.projectId?._id || task.projectId,
      actualHours: task.actualHours,
      plannedHours: task.plannedHours,
    },
  });
  if (isQaSyncGamification()) await job;
};

const TIMELINE_FIELDS = new Set(['scheduleDate', 'scheduleSlot', 'startDate', 'dueDate', 'duration']);

const isEmptyTimelineValue = (value) => value == null || value === '';

const timelineFieldUnchanged = (field, nextVal, existing) => {
  if (nextVal === undefined) return true;
  const prev = existing?.[field];
  if (field === 'scheduleDate' || field === 'dueDate' || field === 'startDate') {
    if (isEmptyTimelineValue(nextVal) && isEmptyTimelineValue(prev)) return true;
    const nextTime = new Date(nextVal).getTime();
    const prevTime = new Date(prev).getTime();
    return !Number.isNaN(nextTime) && !Number.isNaN(prevTime) && nextTime === prevTime;
  }
  if (field === 'duration') {
    return Number(nextVal ?? 0) === Number(prev ?? 0);
  }
  if (field === 'scheduleSlot') {
    const norm = (v) => String(v || 'FULL').toUpperCase();
    return norm(nextVal) === norm(prev);
  }
  return String(nextVal) === String(prev ?? '');
};

/** Drop timeline keys that match existing task — avoids blocking project-only edits. */
const stripUnchangedTimelineFields = (coreUpdates, existing) => {
  for (const field of TIMELINE_FIELDS) {
    if (
      coreUpdates[field] !== undefined
      && timelineFieldUnchanged(field, coreUpdates[field], existing)
    ) {
      delete coreUpdates[field];
    }
  }
};

const memberRoleUserId = (entry) => (entry?.user?._id || entry?.user)?.toString?.() || null;

const getProjectRole = (project, userId) => {
  if (!project || !userId) return null;
  const uid = userId.toString();
  const ownerId = (project.owner?._id || project.owner)?.toString?.();
  if (ownerId && ownerId === uid) return 'admin';
  const isMember = project.members?.some((m) => (m?._id || m)?.toString() === uid);
  const hasRoleEntry = (project.memberRoles || []).some(
    (entry) => memberRoleUserId(entry) === uid
  );
  if (!isMember && !hasRoleEntry) return null;
  return getProjectRoleForUser(project, userId);
};

/** Any authenticated user who can mutate a task may assign to any tenant user. */
const canAssignTasks = () => true;

const userHasProjectAccess = (project, userId) => Boolean(getProjectRole(project, userId));

const normalizeProjectId = (value) => {
  if (value === undefined || value === null || value === '') return null;
  return value.toString();
};

const mapTaskDTO = (taskDoc) => {
  const task = taskDoc.toObject ? taskDoc.toObject({ virtuals: true }) : { ...taskDoc };
  if (!task.workspace) {
    task.workspace = task.projectId?.workspace || 'General';
  }
  if (task.assignees && Array.isArray(task.assignees)) {
    task.assignments = task.assignees.map((a) => ({
      userId: a.userId?._id || a.userId,
      user: a.userId,
      assignedBy: a.assignedBy,
      assignedAt: a.assignedAt
    }));
    task.assignees = task.assignees.map((a) => a.userId || a);
    task.assignedBy = task.assignments[0]?.assignedBy || task.createdBy;
  }
  return task;
};

exports.mapTaskDTO = mapTaskDTO;

const buildAssignmentsForUser = (taskId, assigneeIds, actingUserId, creatorId, previousAssignments = []) => {
  const creator = rulesNormalizeId(creatorId || actingUserId);
  const actor = actingUserId.toString();
  const prevAssignerByUser = new Map(
    (previousAssignments || []).map((a) => [
      rulesAssignmentUserId(a),
      assignmentAssignerId(a),
    ]).filter(([uid]) => uid)
  );
  return assigneeIds.map((userId) => {
    const uid = rulesNormalizeId(userId);
    const preservedAssigner = prevAssignerByUser.get(uid);
    return {
      taskId,
      userId: uid,
      assignedBy: preservedAssigner || (uid === creator ? uid : actor),
    };
  });
};

const getPlatformOwnerUserId = async (session = null) => {
  const owner = await resolvePlatformOwnerUser({ session, select: '_id' });
  return owner?._id?.toString() || null;
};

const othersExcludeActorAndRaghav = (assigneeIds, actorId, raghavId) =>
  assigneeIds.filter((id) => id !== actorId && id !== raghavId);

/** Add @mentioned users as task assignees; returns assignment notification payloads. */
exports.addMentionedUsersAsAssignees = async ({
  taskId,
  mentionedUserIds = [],
  user,
  session,
}) => {
  const pendingNotifications = [];
  const task = await Task.findById(taskId).session(session);
  if (!task) return { pendingNotifications };

  const scopedToAdd = await filterUserIdsByTaskScope(task, mentionedUserIds, session);
  const toAdd = [...new Set(scopedToAdd.map((id) => id?.toString?.()).filter(Boolean))];
  if (!toAdd.length || !taskId || !user?._id) {
    return { pendingNotifications };
  }

  const assignments = await findTaskAssignments(task._id, session);
  const currentIds = assignments.map((a) => assignmentUserId(a.userId)).filter(Boolean);
  const creatorId = (task.createdBy?._id || task.createdBy)?.toString();
  const newIds = toAdd.filter((id) => !currentIds.includes(id) && id !== creatorId);
  if (!newIds.length) return { pendingNotifications };

  const merged = normalizeTaskAssigneeIds([...currentIds, ...newIds], creatorId);
  const oldAssignmentsSnapshot = [...assignments];

  const insertedAssignments = buildAssignmentsForUser(task._id, merged, user._id, creatorId);
  await replaceTaskAssignments(task._id, insertedAssignments, session);

  const TaskActivityService = require('./TaskActivityService');
  await TaskActivityService.recordAssignmentChanges(
    task._id,
    oldAssignmentsSnapshot,
    insertedAssignments.map((a) => ({
      userId: a.userId,
      assignedBy: a.assignedBy,
    })),
    user,
    session
  );

  for (const userId of newIds) {
    if (userId === user._id.toString()) continue;
    pendingNotifications.push({
      recipientId: userId,
      title: 'New Task Assigned',
      message: `${user.name} assigned you: "${task.title}"`,
      category: 'task',
      relatedTaskId: task._id,
      relatedProjectId: task.projectId,
      actionUrl: buildTaskActionUrl(task),
      actorId: user._id,
      iconType: 'user',
    });
  }

  return { pendingNotifications };
};

const formatHoursForLog = (hours) => formatTimeSpent(hours);

const getProjectNameForTask = async (task, session) => {
  if (!task.projectId) return 'Unassigned';
  const projectDoc = await Project.findById(task.projectId?._id || task.projectId).session(session);
  return projectDoc?.name || 'Unassigned';
};

const findTaskDailyLog = async (userId, taskId, type, session) => Log.findOne({
  userId,
  targetId: taskId,
  targetType: 'Task',
  action: 'DAILY_LOG',
  'details.type': type,
}).session(session);

const createTaskDailyLog = async ({
  userId, task, type, hours, message, title, session,
}) => {
  const projectName = await getProjectNameForTask(task, session);
  const projectId = task.projectId?._id || task.projectId || null;
  await Log.create([{
    userId,
    actorId: String(userId),
    origin: 'HUMAN_USER',
    action: 'DAILY_LOG',
    details: {
      type,
      title: title ?? task.title,
      message,
      project: projectName,
      projectId,
      timeSpent: formatHoursForLog(hours),
    },
    targetId: task._id,
    targetType: 'Task',
  }], { session });
  refreshAttendanceMetricsForUserDay(userId, new Date()).catch(() => {});
};

const resolveReviewHoursFromUpdates = (updates = {}) => {
  if (updates.reviewHours != null && Number.isFinite(Number(updates.reviewHours))) {
    return Math.max(0, Number(updates.reviewHours));
  }
  if (updates.reviewMinutes != null && Number.isFinite(Number(updates.reviewMinutes))) {
    return Math.max(0, Number(updates.reviewMinutes)) / 60;
  }
  return REVIEW_DEFAULT_HOURS;
};

const finalizeTaskApproval = async (task, session) => {
  if (task.projectId) {
    await Project.findByIdAndUpdate(
      task.projectId?._id || task.projectId,
      { $inc: { completedTasksCount: 1 } },
      { session }
    );
  }
};

const removeReviewLogsForTask = async (taskId, assigneeIds, reviewerId, session) => {
  const userIds = [...new Set([...(assigneeIds || []), reviewerId].filter(Boolean))];
  if (!userIds.length) return;
  await Log.deleteMany({
    targetId: taskId,
    targetType: 'Task',
    userId: { $in: userIds },
    'details.type': { $in: ['TASK_COMPLETION', 'TASK_REVIEW'] },
  }).session(session);
};

const createReviewSubmitLogs = async ({
  task, assigneeId, hoursSubmitted, session,
}) => {
  const projectName = await getProjectNameForTask(task, session);
  const existingCompletion = await findTaskDailyLog(assigneeId, task._id, 'TASK_COMPLETION', session);
  if (!existingCompletion) {
    await createTaskDailyLog({
      userId: assigneeId,
      task,
      type: 'TASK_COMPLETION',
      hours: hoursSubmitted,
      message: `Submitted for review within ${projectName}.`,
      session,
    });
  }
};

const finalizeAssigneeCompletionOnApprove = async ({ task, assignments, session }) => {
  const projectName = await getProjectNameForTask(task, session);
  const delegated = getDelegatedAssignments(assignments);
  if (!delegated.length) return;

  for (const a of delegated) {
    const assigneeId = assignmentUserId(a.userId);
    if (!assigneeId) continue;

    const hours = Math.max(
      Number(task.actualHours) || 0,
      MIN_COMPLETION_MINUTES / 60
    );
    const timeSpentStr = hours > 0
      ? formatTimeSpent(hours)
      : (task.plannedHours > 0 ? formatTimeSpent(task.plannedHours) : '1h');
    const message = `Successfully completed task within ${projectName}.`;

    const existing = await findTaskDailyLog(assigneeId, task._id, 'TASK_COMPLETION', session);
    if (existing) {
      await Log.updateOne(
        { _id: existing._id },
        {
          $set: {
            'details.type': 'TASK_COMPLETION',
            'details.title': task.title,
            'details.message': message,
            'details.timeSpent': timeSpentStr,
            'details.project': projectName,
            'details.projectId': task.projectId?._id || task.projectId || null,
          },
        },
        { session }
      );
      continue;
    }

    await createTaskDailyLog({
      userId: assigneeId,
      task,
      type: 'TASK_COMPLETION',
      hours,
      message,
      session,
    });
  }
};

const createReviewApprovalLog = async ({
  task, reviewerId, reviewHours, session,
}) => {
  await Log.deleteMany({
    userId: reviewerId,
    targetId: task._id,
    targetType: 'Task',
    'details.type': 'TASK_COMPLETION',
  }).session(session);

  const existingReview = await findTaskDailyLog(reviewerId, task._id, 'TASK_REVIEW', session);
  const timeSpent = formatHoursForLog(reviewHours);
  if (existingReview) {
    await Log.updateOne(
      { _id: existingReview._id },
      {
        $set: {
          'details.type': 'TASK_REVIEW',
          'details.title': REVIEW_LOG_LABEL,
          'details.message': REVIEW_LOG_LABEL,
          'details.timeSpent': timeSpent,
        },
      },
      { session }
    );
    return;
  }

  await createTaskDailyLog({
    userId: reviewerId,
    task,
    type: 'TASK_REVIEW',
    hours: reviewHours,
    title: REVIEW_LOG_LABEL,
    message: REVIEW_LOG_LABEL,
    session,
  });
};

const finalizeTaskCompletion = async (task, user, session) => {
  const projectName = await getProjectNameForTask(task, session);
  const timeSpentStr = task.actualHours > 0
    ? formatTimeSpent(task.actualHours)
    : (task.plannedHours > 0 ? formatTimeSpent(task.plannedHours) : '1h');

  await Log.create([{
    userId: user._id,
    actorId: user._id.toString(),
    origin: 'HUMAN_USER',
    action: 'DAILY_LOG',
    details: {
      type: 'TASK_COMPLETION',
      title: task.title,
      message: `Successfully completed task within ${projectName}.`,
      project: projectName,
      projectId: task.projectId?._id || task.projectId,
      timeSpent: timeSpentStr,
    },
    targetId: task._id,
    targetType: 'Task',
  }], { session });

  await finalizeTaskApproval(task, session);
};

exports.createTask = async (taskData, user, session) => {
  const { assignees, ...coreData } = taskData;

  let project = null;
  if (coreData.projectId) {
    project = await Project.findById(coreData.projectId).session(session);
    if (!coreData.workspace && project?.workspace) {
      coreData.workspace = project.workspace;
    }
  }
  if (!coreData.workspace) coreData.workspace = 'General';

  if (project && userIsProjectViewer(project, user._id) && !isAdminUser(user)) {
    throw new Error('Not authorized to create tasks on this project');
  }

  if (!coreData.scheduleDate && coreData.dueDate) {
    coreData.scheduleDate = coreData.dueDate;
  }

  applyPriorityDueDate(coreData);

  const { sanitizeName } = require('../../../utils/sanitizer');
  if (coreData.title) coreData.title = sanitizeName(coreData.title);
  if (coreData.description) coreData.description = sanitizeName(coreData.description);

  const timelineCheck = validateTaskTimelineForRequest(coreData);
  if (!timelineCheck.ok) {
    throw new Error(timelineCheck.error);
  }

  const mentionedUserIds = await resolveMentionedUserIds(coreData.title, coreData.description);
  const scopedMentionSet = new Set(
    await filterUserIdsByTaskScope(
      { projectId: coreData.projectId, workspace: coreData.workspace },
      [...mentionedUserIds],
      session
    )
  );
  const assigneeIds = normalizeTaskAssigneeIds(
    [...(assignees || []).map((id) => id.toString()), ...scopedMentionSet],
    user._id
  );

  const actorId = user._id.toString();
  const platformOwnerId = await getPlatformOwnerUserId(session);
  const others = othersExcludeActorAndRaghav(assigneeIds, actorId, platformOwnerId);

  if (others.length) {
    await assertAssigneesAreTenantUsers({ assigneeIds: others, session });
  }

  const [task] = await Task.create([{ ...coreData, createdBy: user._id }], { session });
  await syncMentionAccessIds(task, session);

  const pendingNotifications = [];
  const assignments = buildAssignmentsForUser(task._id, assigneeIds, user._id, user._id);
  await TaskAssignment.insertMany(assignments, { session });

  for (const userId of assigneeIds) {
    if (userId !== user._id.toString()) {
      pendingNotifications.push({
        recipientId: userId,
        title: 'New Task Assigned',
        message: `${user.name} assigned you: "${task.title}"`,
        category: 'task',
        relatedTaskId: task._id,
        relatedProjectId: task.projectId,
        actionUrl: buildTaskActionUrl(task),
        actorId: user._id,
        iconType: 'user'
      });
    }
  }

  const mentionNotifsTitle = await buildMentionNotifications({
    text: coreData.title,
    previousText: '',
    actor: user,
    assigneeIds,
    task,
  });
  const mentionSeen = new Set();
  for (const payload of mentionNotifsTitle) {
    if (mentionSeen.has(payload.recipientId)) continue;
    mentionSeen.add(payload.recipientId);
    pendingNotifications.push(payload);
  }

  if (task.projectId) {
    await Project.findByIdAndUpdate(task.projectId, { $inc: { totalTasksCount: 1 } }, { session });
  }

  await logActivity(user._id, 'CREATE_TASK', task._id, 'Task', { title: task.title }, session);
  queueGamificationEvent('TASK_CREATED', { userId: user._id, task });

  const TaskActivityService = require('./TaskActivityService');
  await TaskActivityService.seedCreatedAndAssignments(
    task,
    assignments.map((a) => ({
      userId: a.userId,
      assignedBy: a.assignedBy,
    })),
    user,
    session
  );

  if (coreData.description) {
    const mentionNotifsThread = await buildMentionNotifications({
      text: coreData.description,
      previousText: '',
      actor: user,
      assigneeIds,
      task,
      source: 'thread',
    });
    const mentionedUserIds = await TaskActivityService.resolveMentionedUserIdsFromText(
      coreData.description
    );
    await TaskActivityService.bumpMentionReceipts(task._id, mentionedUserIds, user._id, session);
    for (const payload of mentionNotifsThread) {
      if (mentionSeen.has(payload.recipientId)) continue;
      mentionSeen.add(payload.recipientId);
      pendingNotifications.push(payload);
    }
  }

  const taskObj = task.toObject({ virtuals: true });
  taskObj.createdBy = { _id: user._id, name: user.name, avatar: user.avatar };
  taskObj.assignees = assignments.map((a) => ({
    userId: a.userId,
    assignedBy: a.assignedBy,
    assignedAt: new Date()
  }));

  publishTaskCreated(task);
  syncDualWrite.upsertTask(task);

  return { taskDto: mapTaskDTO(taskObj), pendingNotifications };
};

exports.getTasks = async (filter, { userId = null, listMode = false, completedListMode = false, page, limit, sort } = {}) => {
  const sortSpec = sort && Object.keys(sort).length ? sort : { dueDate: 1, _id: 1 };

  if (completedListMode) {
    const leanQuery = Task.find(filter)
      .select('_id title status completedAt createdBy')
      .populate('createdBy', 'name avatar')
      .populate(TASK_LIST_ASSIGNEE_POPULATE);
    if (page && limit) {
      const skip = (Math.max(1, page) - 1) * limit;
      const scopeKey = JSON.stringify({ filter, listMode, completedListMode });
      const tenantId = filter.tenantId?.toString?.() || 'default';
      const cacheUserId = userId || 'anon';
      let total = await getTaskListCountsCache(tenantId, cacheUserId, scopeKey);
      if (total == null) {
        total = await Task.countDocuments(filter);
        await setTaskListCountsCache(tenantId, cacheUserId, scopeKey, total);
      }
      const tasks = await leanQuery.sort(sortSpec).skip(skip).limit(limit).lean({ virtuals: true });
      return {
        tasks: tasks.map(mapTaskDTO),
        total,
        page: Math.max(1, page),
        pages: Math.max(1, Math.ceil(total / limit)),
      };
    }
    const tasks = await leanQuery.sort(sortSpec).lean({ virtuals: true });
    return tasks.map(mapTaskDTO);
  }

  const assigneePopulate = listMode ? TASK_LIST_ASSIGNEE_POPULATE : TASK_ASSIGNEE_POPULATE;
  const createdByPopulate = listMode
    ? { path: 'createdBy', select: 'name avatar' }
    : { path: 'createdBy', select: 'name avatar', populate: { path: 'departmentId', select: 'name' } };

  const baseQuery = Task.find(filter)
    .select('title description status priority type scheduleSlot scheduleDate projectId workspace progress dueDate startDate duration plannedHours actualHours completedAt updatedAt createdBy mentionAccessIds color')
    .populate('projectId', 'name workspace')
    .populate(createdByPopulate)
    .populate(assigneePopulate);

  const attachUnread = async (mapped) => {
    if (!userId || !mapped.length) return mapped;
    const taskIds = mapped.map((t) => t._id);
    const TaskActivityService = require('./TaskActivityService');
    const unreadMap = await TaskActivityService.getUnreadMentionCountsByTask(userId, taskIds);
    return mapped.map((t) => ({
      ...t,
      unreadMentions: unreadMap[t._id.toString()] || 0,
    }));
  };

  if (page && limit) {
    const skip = (Math.max(1, page) - 1) * limit;
    const scopeKey = JSON.stringify({ filter, listMode, completedListMode });
    const tenantId = filter.tenantId?.toString?.() || 'default';
    const cacheUserId = userId || 'anon';
    let total = await getTaskListCountsCache(tenantId, cacheUserId, scopeKey);
    if (total == null) {
      total = await Task.countDocuments(filter);
      await setTaskListCountsCache(tenantId, cacheUserId, scopeKey, total);
    }
    const tasks = await baseQuery.sort(sortSpec).skip(skip).limit(limit).lean({ virtuals: true });
    const mapped = tasks.map(mapTaskDTO);
    const withUnread = await attachUnread(mapped);
    return {
      tasks: withUnread,
      total,
      page: Math.max(1, page),
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  const tasks = await baseQuery.sort(sortSpec).lean({ virtuals: true });
  const mapped = tasks.map(mapTaskDTO);
  return attachUnread(mapped);
};

/** KPI counts for Todo overview chips (user-scoped base filter, no UI filters). */
exports.getTodoStats = async (baseFilter) => {
  const { getDateKey, startOfDayFromKey } = require('../../../utils/attendanceDate');
  const todayStart = startOfDayFromKey(getDateKey());
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const overdueMatch = {
    status: { $ne: 'done' },
    $expr: {
      $and: [
        { $ne: [{ $ifNull: ['$dueDate', '$scheduleDate'] }, null] },
        { $lt: [{ $ifNull: ['$dueDate', '$scheduleDate'] }, todayStart] },
      ],
    },
  };
  const todayMatch = {
    status: { $ne: 'done' },
    $expr: {
      $and: [
        { $gte: [{ $ifNull: ['$dueDate', '$scheduleDate'] }, todayStart] },
        { $lt: [{ $ifNull: ['$dueDate', '$scheduleDate'] }, tomorrow] },
      ],
    },
  };

  const [facet] = await Task.aggregate([
    { $match: baseFilter },
    {
      $facet: {
        open: [{ $match: { status: { $ne: 'done' } } }, { $count: 'n' }],
        inReview: [{ $match: { status: 'in-review' } }, { $count: 'n' }],
        overdue: [{ $match: overdueMatch }, { $count: 'n' }],
        today: [{ $match: todayMatch }, { $count: 'n' }],
      },
    },
  ]);

  const pick = (bucket) => bucket?.[0]?.n || 0;
  return {
    open: pick(facet?.open),
    inReview: pick(facet?.inReview),
    overdue: pick(facet?.overdue),
    today: pick(facet?.today),
  };
};

exports.updateTask = async (taskId, updates, user, session) => {
  const pendingNotifications = [];
  const existing = await Task.findById(taskId).session(session).populate('assignees');
  if (!existing) throw new Error('Task not found');

  const VALID_TASK_STATUSES = new Set(['todo', 'in-progress', 'in-review', 'done']);
  if (updates.status !== undefined && updates.status !== null && updates.status !== '') {
    const statusVal = String(updates.status).toLowerCase();
    if (!VALID_TASK_STATUSES.has(statusVal)) {
      throw new Error('Invalid task status');
    }
  }

  const assignments = existing.assignees || [];
  const isCreator = existing.createdBy?.toString() === user._id.toString();
  const isAssignee = assignments.some((a) => assignmentUserId(a.userId) === user._id.toString());
  const primaryAssignedBy = assignmentUserId(assignments[0]?.assignedBy);
  const assigneeIds = assignments.map((a) => assignmentUserId(a.userId)).filter(Boolean);

  const mentionedUserIds = await resolveMentionedUserIds(existing.title, existing.description);
  const hasMentionAccess = (existing.mentionAccessIds || []).some(
    (id) => (id?._id || id)?.toString() === user._id.toString()
  ) || (
    mentionedUserIds.has(user._id.toString())
    && await userHasTaskScopeAccess(existing, user._id, session)
  );
  const isMentioned = hasMentionAccess;
  const mentionOnly = !isAdminUser(user)
    && !canUserApproveReview(user, assignments)
    && isMentionOnlyUser(user._id, assigneeIds, mentionedUserIds);

  const {
    assignees,
    reviewAction,
    reviewHours: _reviewHours,
    reviewMinutes: _reviewMinutes,
    ...coreUpdates
  } = updates;
  const reviewHoursForApproval = resolveReviewHoursFromUpdates(updates);

  const { sanitizeName } = require('../../../utils/sanitizer');
  if (coreUpdates.title !== undefined) coreUpdates.title = sanitizeName(coreUpdates.title);
  if (coreUpdates.description !== undefined) coreUpdates.description = sanitizeName(coreUpdates.description);

  const rollbackReasonText = reviewAction === 'rollback'
    ? String(coreUpdates.description || '').trim()
    : '';
  if (reviewAction === 'rollback') {
    delete coreUpdates.description;
  }

  let sourceProject = null;
  if (existing.projectId) {
    sourceProject = await Project.findById(existing.projectId).session(session);
  }
  if (sourceProject && userIsProjectViewer(sourceProject, user._id) && !isAdminUser(user)) {
    throw new Error('Not authorized to update this task');
  }
  const isSourceProjectMember = sourceProject && userHasProjectAccess(sourceProject, user._id);

  const platformOwnerId = await getPlatformOwnerUserId(session);
  let isReviewer = false;
  if (reviewAction === 'approve') {
    if (String(existing.status || '').toLowerCase() !== 'in-review') {
      throw new Error('Only in-review tasks can be approved');
    }
    isReviewer = canUserApproveOrRollback(user, assignments, {
      platformOwnerId,
      taskCreatedBy: existing.createdBy,
    });
    if (!isReviewer) {
      throw new Error('Only the person who assigned this task can approve');
    }
  }
  if (reviewAction === 'rollback') {
    const rollbackableStatus = String(existing.status || '').toLowerCase();
    if (rollbackableStatus !== 'in-review' && rollbackableStatus !== 'done') {
      throw new Error('Only in-review or completed tasks can be rolled back');
    }
    const canRollback = canUserRollbackTask(user, existing, assignments, {
      platformOwnerId,
      taskCreatedBy: existing.createdBy,
    });
    if (!canRollback) {
      throw new Error('You are not allowed to roll back this task');
    }
    isReviewer = true;
  }

  if (!isCreator && !isAssignee && !isAdminUser(user) && !isReviewer && !isSourceProjectMember && !isMentioned) {
    throw new Error('Not authorized to update this task');
  }

  const previousProjectId = normalizeProjectId(existing.projectId);
  let projectMoveRollup = null;

  if (coreUpdates.projectId !== undefined) {
    const nextProjectId = normalizeProjectId(coreUpdates.projectId);
    if (nextProjectId !== previousProjectId) {
      if (nextProjectId && !mongoose.Types.ObjectId.isValid(nextProjectId)) {
        throw new Error('Invalid project');
      }
      let targetProject = null;
      if (nextProjectId) {
        targetProject = await Project.findById(nextProjectId).session(session);
        if (!targetProject) throw new Error('Project not found');
        if (!userHasProjectAccess(targetProject, user._id)) {
          throw new Error('Not authorized to move task to this project');
        }
        coreUpdates.workspace = targetProject.workspace || coreUpdates.workspace || 'General';
      } else {
        coreUpdates.workspace = coreUpdates.workspace || 'General';
      }
      coreUpdates.phaseId = null;
      projectMoveRollup = { previousProjectId, nextProjectId };
    } else if (coreUpdates.projectId === null || coreUpdates.projectId === '') {
      coreUpdates.projectId = null;
      coreUpdates.phaseId = null;
    }
  }

  if (reviewAction === 'approve' || reviewAction === 'rollback') {
    if (reviewAction === 'approve') {
      coreUpdates.status = 'done';
    } else {
      coreUpdates.status = 'in-progress';
      coreUpdates.completedAt = null;
      coreUpdates.progress = Math.min(existing.progress || 0, 90);
    }
    for (const field of TIMELINE_FIELDS) {
      delete coreUpdates[field];
    }
    delete coreUpdates.priority;
    delete coreUpdates.projectId;
    delete coreUpdates.workspace;
    delete coreUpdates.type;
    delete coreUpdates.title;
    delete coreUpdates.assignees;
  }

  stripUnchangedTimelineFields(coreUpdates, existing);

  const timelineTouched = Object.keys(coreUpdates).some((k) => TIMELINE_FIELDS.has(k));
  if (timelineTouched) {
    const canEditTimeline = isCreator
      || primaryAssignedBy === user._id.toString()
      || isAdminUser(user);
    if (!canEditTimeline) {
      throw new Error('Only the task creator or assigner can change timeline fields');
    }
  }

  const hasDelegatedWork = getDelegatedAssignments(assignments).length > 0;

  if (
    coreUpdates.status === 'done'
    && !reviewAction
    && !isCreator
    && isAssignerOnlyReviewer(assignments, user._id)
  ) {
    throw new Error(
      'This task must be completed by the assignee first. Approve it from the review queue when ready.'
    );
  }

  const existingStatus = String(existing.status || '').toLowerCase();
  const reopeningDone = existingStatus === 'done'
    && coreUpdates.status
    && String(coreUpdates.status).toLowerCase() !== 'done';
  if (reopeningDone) {
    const canReopen = canUserRollbackTask(user, existing, assignments, {
      platformOwnerId,
      taskCreatedBy: existing.createdBy,
    });
    if (!canReopen) {
      throw new Error('You are not allowed to change the status of this completed task');
    }
  }

  if (coreUpdates.status === 'done' || coreUpdates.status === 'in-review') {
    const needsReview = !isCreator && needsReviewOnComplete(assignments, user._id, {
      mentionOnly,
      taskCreatedBy: existing.createdBy,
    });
    if (coreUpdates.status === 'done' && !reviewAction && needsReview) {
      coreUpdates.status = 'in-review';
    }
    if (coreUpdates.status === 'in-review' && !reviewAction && !needsReview) {
      coreUpdates.status = 'done';
    }
    if (coreUpdates.status === 'done') {
      coreUpdates.completedAt = new Date();
      coreUpdates.progress = 100;
    } else if (coreUpdates.status === 'in-review') {
      coreUpdates.completedAt = null;
    } else if (coreUpdates.status === 'in-progress') {
      coreUpdates.completedAt = null;
    }
  } else if (coreUpdates.status) {
    coreUpdates.completedAt = null;
  }

  if (reopeningDone && existing.projectId) {
    await Project.findByIdAndUpdate(
      existing.projectId?._id || existing.projectId,
      { $inc: { completedTasksCount: -1 } },
      { session }
    );
    const assigneeIdsToClear = assignments
      .map((a) => rulesAssignmentUserId(a))
      .filter(Boolean);
    const reviewerIdsToClear = getDelegatedAssignments(assignments)
      .map((a) => assignmentAssignerId(a))
      .filter(Boolean);
    const logUserIds = [...new Set([...assigneeIdsToClear, ...reviewerIdsToClear, user._id.toString()])];
    await removeReviewLogsForTask(existing._id, logUserIds, null, session);
  }

  const oldDueDate = existing.dueDate;
  applyPriorityDueDate(coreUpdates, existing);

  if (coreUpdates.actualHours != null) {
    coreUpdates.actualHours = clampXpHours(Number(coreUpdates.actualHours) || 0);
  }

  const timelineToValidate = {};
  for (const field of TIMELINE_FIELDS) {
    if (coreUpdates[field] !== undefined) {
      timelineToValidate[field] = coreUpdates[field];
    }
  }
  if (Object.keys(timelineToValidate).length > 0) {
    const timelineCheck = validateTaskTimelineForRequest(timelineToValidate);
    if (!timelineCheck.ok) {
      throw new Error(timelineCheck.error);
    }
  }

  const dueDateChanged = Boolean(
    coreUpdates.dueDate
    && new Date(coreUpdates.dueDate).getTime() !== new Date(oldDueDate || 0).getTime()
  );

  if (coreUpdates.description !== undefined) {
    const TaskActivityService = require('./TaskActivityService');
    const msgBody = String(coreUpdates.description || '').trim();
    const prevBody = String(existing.description || '').trim();
    if (msgBody && msgBody !== prevBody && existing.status !== 'done') {
      const taskCtx = existing.toObject ? existing.toObject() : { ...existing };
      const { mentionPayloads, assignNotifications } = await TaskActivityService.appendTaskMessage({
        task: {
          ...taskCtx,
          _id: existing._id,
          title: coreUpdates.title ?? existing.title,
          projectId: coreUpdates.projectId ?? existing.projectId,
        },
        user,
        body: msgBody,
        previousBody: prevBody,
        session,
      });
      pendingNotifications.push(...mentionPayloads, ...assignNotifications);
    }
    coreUpdates.description = '';
  }

  const task = await Task.findByIdAndUpdate(taskId, coreUpdates, { new: true, runValidators: true, session });

  if (task && projectMoveRollup) {
    const { previousProjectId: oldId, nextProjectId: newId } = projectMoveRollup;
    if (oldId) {
      const dec = { totalTasksCount: -1 };
      if (existing.status === 'done') dec.completedTasksCount = -1;
      await Project.findByIdAndUpdate(oldId, { $inc: dec }, { session });
    }
    if (newId) {
      const inc = { totalTasksCount: 1 };
      if (existing.status === 'done') inc.completedTasksCount = 1;
      await Project.findByIdAndUpdate(newId, { $inc: inc }, { session });
    }
  }

  let assigneesChanged = false;
  if (assignees && task) {
    const existingCreatorId = (existing.createdBy?._id || existing.createdBy)?.toString();
    const incomingAssigneeIds = assignees.map(
      (a) => (typeof a === 'object' && a._id ? a._id : a).toString()
    );
    const newAssigneesForCompare = normalizeTaskAssigneeIds(
      incomingAssigneeIds,
      existingCreatorId || user._id
    );
    const oldAssignees = assignments.map((a) => (a.userId?._id || a.userId).toString());
    const assigneesUnchanged = newAssigneesForCompare.join(',') === oldAssignees.join(',');
    const assignerCreatorId = user._id.toString();
    const newAssignees = assigneesUnchanged
      ? newAssigneesForCompare
      : normalizeTaskAssigneeIds(incomingAssigneeIds, assignerCreatorId);
    let addingOthers = newAssignees.some((id) => id !== user._id.toString());

    if (addingOthers && platformOwnerId) {
      addingOthers = newAssignees.some(
        (id) => id !== user._id.toString() && id !== platformOwnerId
      );
    }

    if (!assigneesUnchanged && addingOthers) {
      const othersToValidate = newAssignees.filter(
        (id) => id !== user._id.toString() && id !== platformOwnerId
      );
      await assertAssigneesAreTenantUsers({ assigneeIds: othersToValidate, session });
    }

    if (!assigneesUnchanged) {
      assigneesChanged = true;
      await Task.findByIdAndUpdate(task._id, { createdBy: user._id }, { session });
      task.createdBy = user._id;
      const oldAssignmentsSnapshot = [...assignments];
      let insertedAssignments = [];
      if (newAssignees.length > 0) {
        insertedAssignments = buildAssignmentsForUser(
          task._id,
          newAssignees,
          user._id,
          assignerCreatorId,
          assignments
        );
      }
      await replaceTaskAssignments(task._id, insertedAssignments, session);
      const TaskActivityService = require('./TaskActivityService');
      await TaskActivityService.recordAssignmentChanges(
        task._id,
        oldAssignmentsSnapshot,
        insertedAssignments.map((a) => ({
          userId: a.userId,
          assignedBy: a.assignedBy,
        })),
        user,
        session
      );

      const previousAssigneeIds = new Set(
        oldAssignmentsSnapshot.map((a) => assignmentUserId(a.userId)).filter(Boolean)
      );
      for (const a of insertedAssignments) {
        const uid = assignmentUserId(a.userId);
        if (!uid || previousAssigneeIds.has(uid) || uid === user._id.toString()) continue;
        pendingNotifications.push({
          recipientId: uid,
          title: 'New Task Assigned',
          message: `${user.name} assigned you: "${task.title}"`,
          category: 'task',
          relatedTaskId: task._id,
          relatedProjectId: task.projectId,
          actionUrl: buildTaskActionUrl(task),
          actorId: user._id,
          iconType: 'user',
        });
      }
    }
  }

  let rollupMeta = null;

  if (task) {
    if (task.projectId || projectMoveRollup?.previousProjectId) {
      rollupMeta = {
        projectId: task.projectId || null,
        phaseId: task.phaseId || null,
        previousProjectId: projectMoveRollup?.previousProjectId || null,
      };
    }
    await logActivity(user._id, 'UPDATE_TASK', task._id, 'Task', { title: task.title, status: task.status }, session);

    if (dueDateChanged) {
      await logActivity(user._id, 'TASK_DATE_CHANGED', task._id, 'Task', { oldDate: oldDueDate, newDate: task.dueDate }, session);
    }

    if (coreUpdates.status === 'in-review' && !reviewAction) {
      const mine = getAssignmentForUser(assignments, user._id);
      const reviewerId = assignmentAssignerId(mine)
        || rulesNormalizeId(existing.createdBy?._id || existing.createdBy);
      const assigneeId = user._id.toString();
      if (existing.status !== 'in-review') {
        const prevHours = Number(existing.actualHours) || 0;
        const nextHours = Number(task.actualHours) || 0;
        let hoursSubmitted = Math.max(0, nextHours - prevHours);
        if (hoursSubmitted <= 0) hoursSubmitted = MIN_COMPLETION_MINUTES / 60;
        await createReviewSubmitLogs({
          task,
          assigneeId,
          hoursSubmitted,
          session,
        });
      }
      if (reviewerId && reviewerId !== assigneeId) {
        pendingNotifications.push({
          recipientId: reviewerId,
          title: 'Review Required',
          message: `${user.name} marked "${task.title}" complete — review required.`,
          category: 'review',
          type: 'alert',
          relatedTaskId: task._id,
          relatedProjectId: task.projectId,
          actionUrl: buildTaskActionUrl(task, { review: true }),
          actorId: user._id,
          iconType: 'user',
        });
      }
    }

    if (reviewAction === 'approve' && task.status === 'done') {
      await finalizeTaskApproval(task, session);
      const freshAssignments = await TaskAssignment.find({ taskId: task._id }).session(session).lean();
      await finalizeAssigneeCompletionOnApprove({
        task,
        assignments: freshAssignments,
        session,
      });
      await createReviewApprovalLog({
        task,
        reviewerId: user._id,
        reviewHours: reviewHoursForApproval,
        session,
      });
      const delegated = getDelegatedAssignments(freshAssignments);
      const completionTargets = delegated.length ? delegated : freshAssignments;
      for (const a of completionTargets) {
        const assigneeId = assignmentUserId(a.userId);
        if (assigneeId) await queueTaskCompletedGamification(assigneeId, task);
      }
      const reviewXpJob = queueGamificationEvent('REVIEW_APPROVED', {
        reviewerId: user._id,
        task: { _id: task._id },
      });
      if (isQaSyncGamification()) await reviewXpJob;
      for (const a of freshAssignments) {
        const assigneeId = assignmentUserId(a.userId);
        if (assigneeId && assigneeId !== user._id.toString()) {
          pendingNotifications.push({
            recipientId: assigneeId,
            title: 'Task Approved',
            message: `"${task.title}" was approved and marked complete.`,
            category: 'review',
            relatedTaskId: task._id,
            relatedProjectId: task.projectId,
            actionUrl: buildTaskActionUrl(task),
            actorId: user._id,
            iconType: 'user',
          });
        }
      }
    }

    if (reviewAction === 'rollback') {
      const TaskActivityService = require('./TaskActivityService');
      if (rollbackReasonText) {
        await TaskActivityService.recordRollback(
          task._id,
          user,
          rollbackReasonText,
          existing.status,
          session
        );
      }

      const actorId = user._id.toString();
      const wasDone = String(existing.status || '').toLowerCase() === 'done';
      if (wasDone && task.projectId) {
        await Project.findByIdAndUpdate(
          task.projectId?._id || task.projectId,
          { $inc: { completedTasksCount: -1 } },
          { session }
        );
      }

      const assigneeIdsToClear = assignments
        .map((a) => rulesAssignmentUserId(a))
        .filter(Boolean);
      const reviewerIdsToClear = getDelegatedAssignments(assignments)
        .map((a) => assignmentAssignerId(a))
        .filter(Boolean);
      const logUserIds = [...new Set([...assigneeIdsToClear, ...reviewerIdsToClear, actorId])];
      await removeReviewLogsForTask(task._id, logUserIds, null, session);

      const reopenTitle = wasDone ? 'Task Reopened' : 'Revision Required';
      const reopenMessage = wasDone
        ? `${user.name} reopened "${task.title}" for more work.`
        : `${user.name} sent "${task.title}" back to In Progress.`;
      const notifyIds = new Set(assigneeIdsToClear);
      for (const a of getDelegatedAssignments(assignments)) {
        const assignerId = assignmentAssignerId(a);
        if (assignerId && assignerId !== actorId) notifyIds.add(assignerId);
      }
      if (existing.createdBy) {
        const creatorId = (existing.createdBy?._id || existing.createdBy)?.toString();
        if (creatorId && creatorId !== actorId) notifyIds.add(creatorId);
      }
      for (const recipientId of notifyIds) {
        if (recipientId === actorId) continue;
        pendingNotifications.push({
          recipientId,
          title: reopenTitle,
          message: reopenMessage,
          category: 'review',
          type: 'alert',
          relatedTaskId: task._id,
          relatedProjectId: task.projectId,
          actionUrl: buildTaskActionUrl(task),
          actorId: user._id,
          iconType: 'user',
        });
      }
    }

    if (String(task.status || '').toLowerCase() === 'done' && !reviewAction) {
      if (!needsReviewOnComplete(assignments, user._id, { mentionOnly, taskCreatedBy: existing.createdBy })) {
        await finalizeTaskCompletion(task, user, session);
        await queueTaskCompletedGamification(user._id, task);
      }
    }

    const TaskActivityService = require('./TaskActivityService');
    const prevStatus = String(existing.status || '').toLowerCase();
    const nextStatus = String(task.status || '').toLowerCase();
    if (nextStatus && prevStatus !== nextStatus) {
      await TaskActivityService.recordStatusChange(
        task._id,
        user,
        prevStatus,
        nextStatus,
        session
      );
    }

    await TaskActivityService.recordFieldChangesFromTask(
      existing,
      task,
      user,
      coreUpdates,
      session
    );

    if (coreUpdates.title !== undefined
      && String(task.title || '') !== String(existing.title || '')) {
      let currentAssignments = assignments;
      if (assigneesChanged) {
        currentAssignments = await findTaskAssignments(task._id, session);
      }
      const currentAssigneeIds = currentAssignments
        .map((a) => assignmentUserId(a.userId))
        .filter(Boolean);
      const newlyMentioned = await resolveNewlyMentionedUserIds(task.title, existing.title);
      const { pendingNotifications: mentionAssignNotifs } = await exports.addMentionedUsersAsAssignees({
        taskId: task._id,
        mentionedUserIds: newlyMentioned,
        user,
        session,
      });
      pendingNotifications.push(...mentionAssignNotifs);
      const mentionNotifsTitle = await buildMentionNotifications({
        text: task.title,
        previousText: existing.title,
        actor: user,
        assigneeIds: [...new Set([...currentAssigneeIds, ...newlyMentioned])],
        task,
      });
      pendingNotifications.push(...mentionNotifsTitle);
    }
  }

  if (!task) {
    throw new Error('Task not found');
  }

  if (
    coreUpdates.title !== undefined
    || coreUpdates.description !== undefined
    || coreUpdates.projectId !== undefined
    || coreUpdates.workspace !== undefined
  ) {
    await syncMentionAccessIds(task, session);
  }

  const populatedTask = await Task.findById(task._id).session(session)
    .populate({ path: 'createdBy', select: 'name avatar', populate: { path: 'departmentId', select: 'name' } })
    .populate(TASK_ASSIGNEE_POPULATE);

  if (!populatedTask) {
    throw new Error('Task not found');
  }

  publishTaskUpdated(populatedTask);
  syncDualWrite.upsertTask(populatedTask);

  return {
    taskDto: mapTaskDTO(populatedTask),
    pendingNotifications,
    rollupMeta,
  };
};

exports.deleteTask = async (taskId, user, session) => {
  const existing = await Task.findById(taskId).session(session);
  if (!existing) throw new Error('Task not found');

  if (existing.projectId) {
    const project = await Project.findById(existing.projectId).session(session);
    if (project && userIsProjectViewer(project, user._id) && !isAdminUser(user)) {
      throw new Error('Not authorized to delete this task');
    }
  }

  if (existing.createdBy?.toString() !== user._id.toString() && !isAdminUser(user)) {
    throw new Error('Not authorized to delete this task');
  }

  const task = await Task.findByIdAndDelete(taskId, { session });
  if (task) {
    await TaskAssignment.deleteMany({ taskId: task._id }, { session }).setOptions(TASK_ASSIGNMENT_BYPASS);
    if (task.projectId) {
      const dec = { totalTasksCount: -1 };
      if (task.status === 'done') dec.completedTasksCount = -1;
      await Project.findByIdAndUpdate(task.projectId, { $inc: dec }, { session });
    }
    await logActivity(user._id, 'DELETE_TASK', task._id, 'Task', { title: task.title }, session);
    const TaskActivityService = require('./TaskActivityService');
    await TaskActivityService.purgeActivityForTasks([task._id]);
    publishTaskDeleted(task);
    syncDualWrite.deleteTask(task._id);
  }
};

const populateTaskQuery = () => Task.find()
  .select('title description status priority type scheduleSlot scheduleDate projectId workspace progress dueDate startDate duration plannedHours actualHours createdBy color')
  .populate('projectId', 'name workspace')
  .populate({ path: 'createdBy', select: 'name avatar', populate: { path: 'departmentId', select: 'name' } })
  .populate(TASK_ASSIGNEE_POPULATE);

exports.getReviewQueue = async (user) => {
  const platformOwnerId = await getPlatformOwnerUserId();
  const isPlatformOwner = platformOwnerId && user._id.toString() === platformOwnerId;

  let taskIds = [];
  if (isPlatformOwner) {
    const inReview = await Task.find({ status: 'in-review' }).select('_id').lean();
    taskIds = inReview.map((t) => t._id);
  } else {
    const filter = getReviewQueueAssignmentFilter(user._id);
    const delegated = await TaskAssignment.find(filter)
      .select('taskId userId assignedBy')
      .lean();
    taskIds = [...new Set(delegated.map((a) => a.taskId))];
  }

  if (!taskIds.length) return [];

  const tasks = await populateTaskQuery()
    .find({ status: 'in-review', _id: { $in: taskIds } })
    .lean({ virtuals: true });

  const mapped = tasks.map(mapTaskDTO);
  return filterReviewQueueTasks(mapped, user, (task) => task.assignments || [], { platformOwnerId });
};

/** Lightweight review counts for sidebar badges — no full task populate. */
exports.countReviewQueue = async (user) => {
  const platformOwnerId = await getPlatformOwnerUserId();
  const isPlatformOwner = platformOwnerId && user._id.toString() === platformOwnerId;

  let taskIds = [];
  if (isPlatformOwner) {
    const inReview = await Task.find({ status: 'in-review' }).select('_id').lean();
    taskIds = inReview.map((t) => t._id);
  } else {
    const filter = getReviewQueueAssignmentFilter(user._id);
    const delegated = await TaskAssignment.find(filter)
      .select('taskId')
      .lean();
    taskIds = [...new Set(delegated.map((a) => a.taskId))];
  }

  if (!taskIds.length) {
    return { pending: 0, projectReview: 0 };
  }

  const [tasks, assignments] = await Promise.all([
    Task.find({ status: 'in-review', _id: { $in: taskIds } })
      .select('_id createdBy projectId')
      .lean(),
    TaskAssignment.find({ taskId: { $in: taskIds } })
      .select('taskId userId assignedBy')
      .lean(),
  ]);

  const assignmentsByTask = new Map();
  for (const row of assignments) {
    const key = String(row.taskId);
    if (!assignmentsByTask.has(key)) assignmentsByTask.set(key, []);
    assignmentsByTask.get(key).push(row);
  }

  const lightweight = tasks.map((task) => ({
    _id: task._id,
    createdBy: task.createdBy,
    projectId: task.projectId,
    assignments: assignmentsByTask.get(String(task._id)) || [],
  }));

  const filtered = filterReviewQueueTasks(
    lightweight,
    user,
    (task) => task.assignments || [],
    { platformOwnerId },
  );

  const projectReview = filtered.filter((task) => {
    const pid = task?.projectId?._id || task?.projectId;
    return pid != null && pid !== '';
  }).length;

  return { pending: filtered.length, projectReview };
};

exports.getProjectRole = getProjectRole;
exports.canAssignTasks = canAssignTasks;
exports.getProjectRoleForUser = getProjectRoleForUser;
