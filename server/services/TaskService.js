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
  mergeAssigneeIdsWithCreator,
  getAssignmentForUser,
  assignmentAssignerId,
  normalizeId: rulesNormalizeId,
} = require('../../shared/taskReviewRules');
const { queueGamificationEvent } = require('./backgroundQueue');
const { buildTaskActionUrl } = require('../utils/notificationActionUrl');
const { buildMentionNotifications, resolveMentionedUserIds, isMentionOnlyUser } = require('../utils/mentionNotifications');
const { isAdminUser } = require('../utils/departmentPermissions');
const { validateTaskTimelineForRequest } = require('../utils/dateValidation');

const assignmentUserId = (value) => (value?._id || value)?.toString?.() || null;

const queueTaskCompletedGamification = async (userId, task) => {
  if (!userId || !task?._id) return;
  const job = queueGamificationEvent('TASK_COMPLETED', {
    userId,
    task: {
      _id: task._id,
      title: task.title,
      projectId: task.projectId?._id || task.projectId,
    },
  });
  if (process.env.QA_SYNC_GAMIFICATION === 'true') await job;
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

const finalizeTaskCompletion = async (task, user, session) => {
  let projectName = 'Unassigned';
  if (task.projectId) {
    const projectDoc = await Project.findById(task.projectId).session(session);
    if (projectDoc) projectName = projectDoc.name;
  }

  const timeSpentStr = task.actualHours > 0
    ? `${task.actualHours}h`
    : (task.plannedHours > 0 ? `${task.plannedHours}h` : '1h');

  await Log.create([{
    userId: user._id,
    action: 'DAILY_LOG',
    details: {
      type: 'TASK_COMPLETION',
      title: task.title,
      message: `Successfully completed task within ${projectName}.`,
      project: projectName,
      projectId: task.projectId,
      timeSpent: timeSpentStr
    },
    targetId: task._id,
    targetType: 'Task'
  }], { session });

  if (task.projectId) {
    await Project.findByIdAndUpdate(
      task.projectId,
      { $inc: { completedTasksCount: 1 } },
      { session }
    );
  }
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

  const assigneeIds = mergeAssigneeIdsWithCreator(
    (assignees || []).map((id) => id.toString()),
    user._id
  );
  
  let hasOthers = assigneeIds.some((id) => id !== user._id.toString());

  if (hasOthers) {
    const User = require('../models/User');
    const raghav = await User.findOne({ email: 'REDACTED_ADMIN@example.com' }).select('_id').lean();
    if (raghav) {
      const raghavId = raghav._id.toString();
      hasOthers = assigneeIds.some((id) => id !== user._id.toString() && id !== raghavId);
    }
  }

  if (hasOthers && project && !canAssignTasks(project, user)) {
    throw new Error('Not authorized to assign tasks to others on this project');
  }

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

  const [task] = await Task.create([{ ...coreData, createdBy: user._id }], { session });

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

  const mentionNotifsDesc = await buildMentionNotifications({
    text: coreData.description,
    previousText: '',
    actor: user,
    assigneeIds,
    task,
  });
  const mentionNotifsTitle = await buildMentionNotifications({
    text: coreData.title,
    previousText: '',
    actor: user,
    assigneeIds,
    task,
  });
  const mentionSeen = new Set();
  for (const payload of [...mentionNotifsDesc, ...mentionNotifsTitle]) {
    if (mentionSeen.has(payload.recipientId)) continue;
    mentionSeen.add(payload.recipientId);
    pendingNotifications.push(payload);
  }

  if (task.projectId) {
    await Project.findByIdAndUpdate(task.projectId, { $inc: { totalTasksCount: 1 } }, { session });
  }

  await logActivity(user._id, 'CREATE_TASK', task._id, 'Task', { title: task.title }, session);
  queueGamificationEvent('TASK_CREATED', { userId: user._id, task });

  const taskObj = task.toObject({ virtuals: true });
  taskObj.createdBy = { _id: user._id, name: user.name, avatar: user.avatar };
  taskObj.assignees = assignments.map((a) => ({
    userId: a.userId,
    assignedBy: a.assignedBy,
    assignedAt: new Date()
  }));

  return { taskDto: mapTaskDTO(taskObj), pendingNotifications };
};

exports.getTasks = async (filter) => {
  const tasks = await Task.find(filter)
    .select('title description status priority type scheduleSlot scheduleDate projectId workspace progress dueDate startDate duration plannedHours actualHours createdBy color')
    .populate('projectId', 'name workspace')
    .populate('createdBy', 'name avatar')
    .populate({ path: 'assignees', populate: [{ path: 'userId', select: 'name avatar' }, { path: 'assignedBy', select: 'name avatar' }] })
    .lean({ virtuals: true });

  return tasks.map(mapTaskDTO);
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
  const isMentioned = mentionedUserIds.has(user._id.toString());
  const mentionOnly = !isAdminUser(user)
    && !canUserApproveReview(user, assignments)
    && isMentionOnlyUser(user._id, assigneeIds, mentionedUserIds);

  const { assignees, reviewAction, ...coreUpdates } = updates;

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
    const newAssignees = mergeAssigneeIdsWithCreator(
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
      await TaskAssignment.deleteMany({ taskId: task._id }, { session });
      if (newAssignees.length > 0) {
        await TaskAssignment.insertMany(
          buildAssignmentsForUser(task._id, newAssignees, user._id, creatorId),
          { session }
        );
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
      const reviewerId = assignmentAssignerId(mine);
      if (reviewerId && reviewerId !== user._id.toString()) {
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
      await finalizeTaskCompletion(task, user, session);
      for (const a of assignments) {
        const assigneeId = assignmentUserId(a.userId);
        if (assigneeId) await queueTaskCompletedGamification(assigneeId, task);
      }
      queueGamificationEvent('REVIEW_APPROVED', {
        reviewerId: user._id,
        task: { _id: task._id },
      });
      for (const a of assignments) {
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

    if (coreUpdates.description !== undefined
      && String(task.description || '') !== String(existing.description || '')) {
      let currentAssignments = assignments;
      if (assigneesChanged) {
        currentAssignments = await TaskAssignment.find({ taskId: task._id }).session(session).lean();
      }
      const currentAssigneeIds = currentAssignments
        .map((a) => assignmentUserId(a.userId))
        .filter(Boolean);
      const mentionNotifsDesc = await buildMentionNotifications({
        text: task.description,
        previousText: existing.description,
        actor: user,
        assigneeIds: currentAssigneeIds,
        task,
      });
      pendingNotifications.push(...mentionNotifsDesc);
    }

    if (coreUpdates.title !== undefined
      && String(task.title || '') !== String(existing.title || '')) {
      let currentAssignments = assignments;
      if (assigneesChanged) {
        currentAssignments = await TaskAssignment.find({ taskId: task._id }).session(session).lean();
      }
      const currentAssigneeIds = currentAssignments
        .map((a) => assignmentUserId(a.userId))
        .filter(Boolean);
      const mentionNotifsTitle = await buildMentionNotifications({
        text: task.title,
        previousText: existing.title,
        actor: user,
        assigneeIds: currentAssigneeIds,
        task,
      });
      pendingNotifications.push(...mentionNotifsTitle);
    }
  }

  if (!task) {
    throw new Error('Task not found');
  }

  const populatedTask = await Task.findById(task._id).session(session)
    .populate('createdBy', 'name avatar')
    .populate({ path: 'assignees', populate: [{ path: 'userId', select: 'name avatar' }, { path: 'assignedBy', select: 'name avatar' }] });

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
  }
};

const populateTaskQuery = () => Task.find()
  .select('title description status priority type scheduleSlot scheduleDate projectId workspace progress dueDate startDate duration plannedHours actualHours createdBy color')
  .populate('projectId', 'name workspace')
  .populate('createdBy', 'name avatar')
  .populate({ path: 'assignees', populate: [{ path: 'userId', select: 'name avatar' }, { path: 'assignedBy', select: 'name avatar' }] });

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
