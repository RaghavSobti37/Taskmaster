const mongoose = require('mongoose');
const Task = require('../models/Task');
const TaskAssignment = require('../models/TaskAssignment');
const Project = require('../models/Project');
const Log = require('../models/Log');
const logActivity = require('../utils/activityLogger');
const { applyPriorityDueDate } = require('../../shared/taskPriorityDates');
const { getProjectRoleForUser } = require('../../shared/projectRoles');
const {
  requiresReviewForUser,
  getReviewQueueAssignmentFilter,
  canUserApproveReview,
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
} = require('../../shared/taskReviewRules');
const { formatTimeSpent, MIN_COMPLETION_MINUTES } = require('../../shared/timeSpent');
const { refreshAttendanceMetricsForUserDay } = require('../utils/refreshAttendanceMetrics');
const { clampXpHours } = require('../../shared/gamificationRules');
const { queueGamificationEvent } = require('./backgroundQueue');
const { buildTaskActionUrl } = require('../utils/notificationActionUrl');
const {
  buildMentionNotifications,
  resolveMentionedUserIds,
  resolveNewlyMentionedUserIds,
  isMentionOnlyUser,
} = require('../utils/mentionNotifications');
const { isAdminUser } = require('../utils/departmentPermissions');
const { validateTaskTimelineForRequest } = require('../utils/dateValidation');
const {
  normalizeAssigneeIds: normalizeTaskAssigneeIds,
  filterUserIdsByTaskScope,
  syncMentionAccessIds,
  userHasTaskScopeAccess,
} = require('../utils/taskAccess');
const { isQaSyncGamification } = require('../utils/qaProbeContext');

const assignmentUserId = (value) => (value?._id || value)?.toString?.() || null;

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

/** Project memberRoles values that may assign tasks to others on that project. */
const PROJECT_ASSIGN_ROLES = new Set(['admin', 'manager', 'artist_management']);

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

const canAssignTasks = (project, user) => {
  if (isAdminUser(user)) return true;
  const role = getProjectRole(project, user._id);
  return Boolean(role && PROJECT_ASSIGN_ROLES.has(role));
};

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

const buildAssignmentsForUser = (taskId, assigneeIds, actingUserId, creatorId) => {
  const creator = rulesNormalizeId(creatorId || actingUserId);
  const actor = actingUserId.toString();
  return assigneeIds.map((userId) => {
    const uid = rulesNormalizeId(userId);
    return {
      taskId,
      userId: uid,
      assignedBy: uid === creator ? uid : actor,
    };
  });
};

const getRaghavUserId = async () => {
  const User = require('../models/User');
  const raghav = await User.findOne({ email: 'REDACTED_ADMIN@example.com' }).select('_id').lean();
  return raghav?._id?.toString() || null;
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
  const task = await Task.findById(taskId).session(session).populate('assignees');
  if (!task) return { pendingNotifications };

  const scopedToAdd = await filterUserIdsByTaskScope(task, mentionedUserIds, session);
  const toAdd = [...new Set(scopedToAdd.map((id) => id?.toString?.()).filter(Boolean))];
  if (!toAdd.length || !taskId || !user?._id) {
    return { pendingNotifications };
  }

  const assignments = task.assignees || [];
  const currentIds = assignments.map((a) => assignmentUserId(a.userId)).filter(Boolean);
  const creatorId = (task.createdBy?._id || task.createdBy)?.toString();
  const newIds = toAdd.filter((id) => !currentIds.includes(id) && id !== creatorId);
  if (!newIds.length) return { pendingNotifications };

  const merged = normalizeTaskAssigneeIds([...currentIds, ...newIds], creatorId);
  const oldAssignmentsSnapshot = [...assignments];

  await TaskAssignment.deleteMany({ taskId: task._id }, { session });
  const insertedAssignments = buildAssignmentsForUser(task._id, merged, user._id, creatorId);
  await TaskAssignment.insertMany(insertedAssignments, { session });

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

  if (!coreData.scheduleDate && coreData.dueDate) {
    coreData.scheduleDate = coreData.dueDate;
  }

  applyPriorityDueDate(coreData);

  const { sanitizeName } = require('../utils/sanitizer');
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
  const raghavId = await getRaghavUserId();
  const others = othersExcludeActorAndRaghav(assigneeIds, actorId, raghavId);
  const mentionOnlyAssign = others.length > 0 && others.every((id) => scopedMentionSet.has(id));

  if (others.length && project && !canAssignTasks(project, user) && !mentionOnlyAssign) {
    throw new Error('Not authorized to assign tasks to others on this project');
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

  return { taskDto: mapTaskDTO(taskObj), pendingNotifications };
};

exports.getTasks = async (filter, { userId = null } = {}) => {
  const tasks = await Task.find(filter)
    .select('title description status priority type scheduleSlot scheduleDate projectId workspace progress dueDate startDate duration plannedHours actualHours completedAt updatedAt createdBy mentionAccessIds color')
    .populate('projectId', 'name workspace')
    .populate({ path: 'createdBy', select: 'name avatar', populate: { path: 'departmentId', select: 'name' } })
    .populate(TASK_ASSIGNEE_POPULATE)
    .lean({ virtuals: true });

  const mapped = tasks.map(mapTaskDTO);
  if (!userId || !mapped.length) return mapped;

  const taskIds = mapped.map((t) => t._id);
  const TaskActivityService = require('./TaskActivityService');
  const unreadMap = await TaskActivityService.getUnreadMentionCountsByTask(userId, taskIds);
  return mapped.map((t) => ({
    ...t,
    unreadMentions: unreadMap[t._id.toString()] || 0,
  }));
};

exports.updateTask = async (taskId, updates, user, session) => {
  const pendingNotifications = [];
  const existing = await Task.findById(taskId).session(session).populate('assignees');
  if (!existing) throw new Error('Task not found');

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

  const { sanitizeName } = require('../utils/sanitizer');
  if (coreUpdates.title !== undefined) coreUpdates.title = sanitizeName(coreUpdates.title);
  if (coreUpdates.description !== undefined) coreUpdates.description = sanitizeName(coreUpdates.description);

  let sourceProject = null;
  if (existing.projectId) {
    sourceProject = await Project.findById(existing.projectId).session(session);
  }
  const isSourceProjectMember = sourceProject && userHasProjectAccess(sourceProject, user._id);

  let isReviewer = false;
  if (reviewAction === 'approve' || reviewAction === 'rollback') {
    isReviewer = canUserApproveReview(user, assignments);
    if (!isReviewer) {
      throw new Error('Only the person who assigned this task can approve or rollback');
    }
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

  if (
    coreUpdates.status === 'done'
    && !reviewAction
    && isAssignerOnlyReviewer(assignments, user._id)
  ) {
    throw new Error(
      'This task must be completed by the assignee first. Approve it from the review queue when ready.'
    );
  }

  if (coreUpdates.status === 'done' || coreUpdates.status === 'in-review') {
    const needsReview = requiresReviewForUser(assignments, user._id) || mentionOnly;
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
    const project = task.projectId ? await Project.findById(task.projectId).session(session) : null;
    const creatorId = (existing.createdBy?._id || existing.createdBy)?.toString();
    const newAssignees = normalizeTaskAssigneeIds(
      assignees.map((a) => (typeof a === 'object' && a._id ? a._id : a).toString()),
      creatorId || user._id
    );
    const oldAssignees = assignments.map((a) => (a.userId?._id || a.userId).toString());
    let addingOthers = newAssignees.some((id) => id !== user._id.toString());

    if (addingOthers) {
      const User = require('../models/User');
      const raghav = await User.findOne({ email: 'REDACTED_ADMIN@example.com' }).select('_id').lean();
      if (raghav) {
        const raghavId = raghav._id.toString();
        addingOthers = newAssignees.some((id) => id !== user._id.toString() && id !== raghavId);
      }
    }

    const assigneesUnchanged = newAssignees.join(',') === oldAssignees.join(',');
    if (!assigneesUnchanged && addingOthers && project && !canAssignTasks(project, user)) {
      throw new Error('Not authorized to assign tasks to others on this project');
    }

    if (!assigneesUnchanged) {
      assigneesChanged = true;
      const oldAssignmentsSnapshot = [...assignments];
      await TaskAssignment.deleteMany({ taskId: task._id }, { session });
      let insertedAssignments = [];
      if (newAssignees.length > 0) {
        insertedAssignments = buildAssignmentsForUser(task._id, newAssignees, user._id, creatorId);
        await TaskAssignment.insertMany(insertedAssignments, { session });
      }
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
      const reviewerId = assignmentAssignerId(mine);
      const assigneeId = user._id.toString();
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
      const reviewerId = user._id.toString();
      const assigneeIdsToClear = getDelegatedAssignments(assignments)
        .filter((a) => assignmentAssignerId(a) === reviewerId)
        .map((a) => rulesAssignmentUserId(a))
        .filter(Boolean);
      await removeReviewLogsForTask(task._id, assigneeIdsToClear, reviewerId, session);
      for (const a of assignments) {
        const assigneeId = assignmentUserId(a.userId);
        if (!assigneeId) continue;
        pendingNotifications.push({
          recipientId: assigneeId,
          title: 'Revision Required',
          message: `${user.name} sent "${task.title}" back to In Progress.`,
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

    if (coreUpdates.status === 'done' && !reviewAction) {
      if (!requiresReviewForUser(assignments, user._id) && !mentionOnly) {
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
        currentAssignments = await TaskAssignment.find({ taskId: task._id }).session(session).lean();
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

  return {
    taskDto: mapTaskDTO(populatedTask),
    pendingNotifications,
    rollupMeta,
  };
};

exports.deleteTask = async (taskId, user, session) => {
  const existing = await Task.findById(taskId).session(session);
  if (!existing) throw new Error('Task not found');

  if (existing.createdBy?.toString() !== user._id.toString() && !isAdminUser(user)) {
    throw new Error('Not authorized to delete this task');
  }

  const task = await Task.findByIdAndDelete(taskId, { session });
  if (task) {
    await TaskAssignment.deleteMany({ taskId: task._id }, { session });
    if (task.projectId) {
      const dec = { totalTasksCount: -1 };
      if (task.status === 'done') dec.completedTasksCount = -1;
      await Project.findByIdAndUpdate(task.projectId, { $inc: dec }, { session });
    }
    await logActivity(user._id, 'DELETE_TASK', task._id, 'Task', { title: task.title }, session);
    const TaskActivityService = require('./TaskActivityService');
    await TaskActivityService.purgeActivityForTasks([task._id]);
  }
};

const populateTaskQuery = () => Task.find()
  .select('title description status priority type scheduleSlot scheduleDate projectId workspace progress dueDate startDate duration plannedHours actualHours createdBy color')
  .populate('projectId', 'name workspace')
  .populate({ path: 'createdBy', select: 'name avatar', populate: { path: 'departmentId', select: 'name' } })
  .populate(TASK_ASSIGNEE_POPULATE);

exports.getReviewQueue = async (user) => {
  const filter = getReviewQueueAssignmentFilter(user._id);
  const delegated = await TaskAssignment.find(filter)
    .select('taskId userId assignedBy')
    .lean();

  const taskIds = [...new Set(delegated.map((a) => a.taskId))];
  if (!taskIds.length) return [];

  const tasks = await populateTaskQuery()
    .find({ status: 'in-review', _id: { $in: taskIds } })
    .lean({ virtuals: true });

  const mapped = tasks.map(mapTaskDTO);
  return filterReviewQueueTasks(mapped, user, (task) => task.assignments || []);
};

exports.getProjectRole = getProjectRole;
exports.canAssignTasks = canAssignTasks;
exports.getProjectRoleForUser = getProjectRoleForUser;
