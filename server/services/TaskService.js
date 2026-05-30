const mongoose = require('mongoose');
const Task = require('../models/Task');
const TaskAssignment = require('../models/TaskAssignment');
const Project = require('../models/Project');
const Log = require('../models/Log');
const { scheduleRollup } = require('../utils/rollup');
const logActivity = require('../utils/activityLogger');
const { applyPriorityDueDate } = require('../../shared/taskPriorityDates');
const { canUserReviewTask, getProjectRoleForUser } = require('../../shared/projectRoles');
const { queueGamificationEvent } = require('./backgroundQueue');
const { createNotification } = require('./notificationDispatcher');
const { buildTaskActionUrl } = require('../utils/notificationActionUrl');
const { isAdminUser } = require('../utils/departmentPermissions');
const logger = require('../utils/logger');

const assignmentUserId = (value) => (value?._id || value)?.toString?.() || null;

const TIMELINE_FIELDS = new Set(['scheduleDate', 'scheduleSlot', 'startDate', 'dueDate', 'duration']);

/** Project memberRoles values that may assign tasks to others on that project. */
const PROJECT_ASSIGN_ROLES = new Set(['owner', 'manager', 'admin', 'artist_management']);

const memberRoleUserId = (entry) => (entry?.user?._id || entry?.user)?.toString?.() || null;

const getProjectRole = (project, userId) => {
  if (!project) return null;
  const uid = userId.toString();
  const ownerId = (project.owner?._id || project.owner)?.toString?.();
  if (ownerId && ownerId === uid) return 'owner';
  const entry = project.memberRoles?.find((r) => memberRoleUserId(r) === uid);
  return entry?.role || (project.members?.some((m) => (m?._id || m)?.toString() === uid) ? 'member' : null);
};

const canAssignTasks = (project, user) => {
  if (isAdminUser(user)) return true;
  const role = getProjectRole(project, user._id);
  return Boolean(role && PROJECT_ASSIGN_ROLES.has(role));
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

const isSelfAssigned = (assignments) => {
  if (!assignments?.length) return true;
  return assignments.every((a) => {
    const assigneeId = (a.userId?._id || a.userId)?.toString();
    const byId = (a.assignedBy?._id || a.assignedBy)?.toString();
    return assigneeId && byId && assigneeId === byId;
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

  const assigneeIds = (assignees || []).map((id) => id.toString());
  const isSelfOnly = assigneeIds.length === 0 || (assigneeIds.length === 1 && assigneeIds[0] === user._id.toString());

  if (!isSelfOnly && project && !canAssignTasks(project, user)) {
    throw new Error('Not authorized to assign tasks to others on this project');
  }

  if (!coreData.scheduleDate && coreData.dueDate) {
    coreData.scheduleDate = coreData.dueDate;
  }

  applyPriorityDueDate(coreData);

  const [task] = await Task.create([coreData], { session });

  const pendingNotifications = [];
  if (assignees && assignees.length > 0) {
    const assignments = assignees.map((userId) => ({
      taskId: task._id,
      userId,
      assignedBy: user._id
    }));
    await TaskAssignment.insertMany(assignments, { session });

    for (const userId of assignees) {
      if (userId.toString() !== user._id.toString()) {
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
  }

  if (task.projectId) {
    await Project.findByIdAndUpdate(task.projectId, { $inc: { totalTasksCount: 1 } }, { session });
  }

  await logActivity(user._id, 'CREATE_TASK', task._id, 'Task', { title: task.title }, session);
  queueGamificationEvent('TASK_CREATED', { userId: user._id, task });

  const responseAssigneeIds = assigneeIds.length > 0 ? assigneeIds : [user._id.toString()];
  const taskObj = task.toObject({ virtuals: true });
  taskObj.createdBy = { _id: user._id, name: user.name, avatar: user.avatar };
  taskObj.assignees = responseAssigneeIds.map((userId) => ({
    userId,
    assignedBy: user._id,
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
  const existing = await Task.findById(taskId).session(session).populate('assignees');
  if (!existing) throw new Error('Task not found');

  const assignments = existing.assignees || [];
  const isCreator = existing.createdBy?.toString() === user._id.toString();
  const isAssignee = assignments.some((a) => assignmentUserId(a.userId) === user._id.toString());
  const primaryAssignedBy = assignmentUserId(assignments[0]?.assignedBy);

  const { assignees, reviewAction, ...coreUpdates } = updates;

  let isReviewer = false;
  if (reviewAction === 'approve' || reviewAction === 'rollback') {
    const reviewProject = existing.projectId
      ? await Project.findById(existing.projectId).session(session).select('owner memberRoles').lean()
      : null;
    isReviewer = canUserReviewTask(user, primaryAssignedBy, reviewProject, isAdminUser(user));
    if (!isReviewer) {
      throw new Error('Only the task assigner or a senior project role can approve or rollback');
    }
  }

  if (!isCreator && !isAssignee && !isAdminUser(user) && !isReviewer) {
    throw new Error('Not authorized to update this task');
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
    const selfAssigned = isSelfAssigned(assignments);
    if (coreUpdates.status === 'done' && !selfAssigned && !reviewAction) {
      coreUpdates.status = 'in-review';
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
  const dueDateChanged = Boolean(
    coreUpdates.dueDate
    && new Date(coreUpdates.dueDate).getTime() !== new Date(oldDueDate || 0).getTime()
  );

  const task = await Task.findByIdAndUpdate(taskId, coreUpdates, { new: true, runValidators: true, session });

  let assigneesChanged = false;
  if (assignees) {
    const project = task.projectId ? await Project.findById(task.projectId).session(session) : null;
    const newAssignees = assignees.map((a) => (typeof a === 'object' && a._id ? a._id : a).toString());
    const oldAssignees = assignments.map((a) => (a.userId?._id || a.userId).toString());
    const addingOthers = newAssignees.some((id) => id !== user._id.toString());

    if (addingOthers && project && !canAssignTasks(project, user)) {
      throw new Error('Not authorized to assign tasks to others on this project');
    }

    if (newAssignees.join(',') !== oldAssignees.join(',')) {
      assigneesChanged = true;
      await TaskAssignment.deleteMany({ taskId: task._id }, { session });
      if (newAssignees.length > 0) {
        await TaskAssignment.insertMany(newAssignees.map((userId) => ({
          taskId: task._id,
          userId,
          assignedBy: user._id
        })), { session });
      }
    }
  }

  if (task) {
    await scheduleRollup(task.projectId, task.phaseId, session);
    await logActivity(user._id, 'UPDATE_TASK', task._id, 'Task', { title: task.title, status: task.status }, session);

    if (dueDateChanged) {
      await logActivity(user._id, 'TASK_DATE_CHANGED', task._id, 'Task', { oldDate: oldDueDate, newDate: task.dueDate }, session);
    }

    if (coreUpdates.status === 'in-review' && !reviewAction) {
      const reviewerIds = new Set();
      const creatorId = (existing.createdBy?._id || existing.createdBy)?.toString();
      const assignerId = (assignments[0]?.assignedBy?._id || assignments[0]?.assignedBy)?.toString();
      if (creatorId) reviewerIds.add(creatorId);
      if (assignerId) reviewerIds.add(assignerId);
      reviewerIds.delete(user._id.toString());

      for (const reviewerId of reviewerIds) {
        try {
          await createNotification({
            recipientId: reviewerId,
            title: 'Review Required',
            message: `${user.name} marked "${task.title}" complete — review required.`,
            category: 'review',
            type: 'alert',
            relatedTaskId: task._id,
            relatedProjectId: task.projectId,
            actionUrl: buildTaskActionUrl(task, { review: true }),
            actorId: user._id,
            iconType: 'user'
          });
        } catch (err) {
          logger.error('Task', 'Review notification failed', { taskId: task._id, error: err.message });
        }
      }
    }

    if (reviewAction === 'approve' && task.status === 'done') {
      await finalizeTaskCompletion(task, user, session);
      for (const a of assignments) {
        const assigneeId = assignmentUserId(a.userId);
        if (assigneeId && assigneeId !== user._id.toString()) {
          try {
            await createNotification({
              recipientId: assigneeId,
              title: 'Task Approved',
              message: `"${task.title}" was approved and marked complete.`,
              category: 'review',
              relatedTaskId: task._id,
              relatedProjectId: task.projectId,
              actionUrl: buildTaskActionUrl(task),
              actorId: user._id,
              iconType: 'user'
            });
          } catch (err) {
            logger.error('Task', 'Approval notification failed', { taskId: task._id, error: err.message });
          }
        }
      }
    }

    if (reviewAction === 'rollback') {
      for (const a of assignments) {
        const assigneeId = assignmentUserId(a.userId);
        if (!assigneeId) continue;
        try {
          await createNotification({
            recipientId: assigneeId,
            title: 'Revision Required',
            message: `${user.name} sent "${task.title}" back to In Progress.`,
            category: 'review',
            type: 'alert',
            relatedTaskId: task._id,
            relatedProjectId: task.projectId,
            actionUrl: buildTaskActionUrl(task),
            actorId: user._id,
            iconType: 'user'
          });
        } catch (err) {
          logger.error('Task', 'Rollback notification failed', { taskId: task._id, error: err.message });
        }
      }
    }

    if (coreUpdates.status === 'done' && !reviewAction) {
      const refreshedAssignments = await TaskAssignment.find({ taskId: task._id }).session(session);
      if (isSelfAssigned(refreshedAssignments)) {
        await finalizeTaskCompletion(task, user, session);
      }
    }
  }

  const populatedTask = await Task.findById(task._id).session(session)
    .populate('createdBy', 'name avatar')
    .populate({ path: 'assignees', populate: [{ path: 'userId', select: 'name avatar' }, { path: 'assignedBy', select: 'name avatar' }] });

  return mapTaskDTO(populatedTask);
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
  const baseFilter = { status: 'in-review' };
  let tasks;

  if (isAdminUser(user)) {
    tasks = await populateTaskQuery().find(baseFilter).lean({ virtuals: true });
    return tasks.map(mapTaskDTO);
  }

  const myAssignments = await TaskAssignment.find({ assignedBy: user._id }).select('taskId').lean();
  const directTaskIds = myAssignments.map((a) => a.taskId);

  const memberProjects = await Project.find({
    $or: [{ owner: user._id }, { members: user._id }],
  }).select('_id owner memberRoles').lean();
  const projectIds = memberProjects.map((p) => p._id);
  const projectsById = new Map(memberProjects.map((p) => [p._id.toString(), p]));

  tasks = await populateTaskQuery().find({
    ...baseFilter,
    $or: [
      { _id: { $in: directTaskIds } },
      ...(projectIds.length ? [{ projectId: { $in: projectIds } }] : []),
    ],
  }).lean({ virtuals: true });

  const mapped = tasks.map(mapTaskDTO);
  return mapped.filter((task) => {
    const assignerId = assignmentUserId(task.assignments?.[0]?.assignedBy)
      || assignmentUserId(task.assignedBy);
    const pid = task.projectId?._id || task.projectId;
    const project = pid ? projectsById.get(String(pid)) : null;
    return canUserReviewTask(user, assignerId, project, false);
  });
};

exports.getProjectRole = getProjectRole;
exports.canAssignTasks = canAssignTasks;
exports.getProjectRoleForUser = getProjectRoleForUser;
