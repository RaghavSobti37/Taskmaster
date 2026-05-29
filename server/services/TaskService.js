const mongoose = require('mongoose');
const Task = require('../models/Task');
const TaskAssignment = require('../models/TaskAssignment');
const Project = require('../models/Project');
const Log = require('../models/Log');
const { calculateRollup } = require('../utils/rollup');
const logActivity = require('../utils/activityLogger');
const { queueGamificationEvent } = require('./backgroundQueue');
const { createNotification } = require('./notificationDispatcher');
const { buildTaskActionUrl } = require('../utils/notificationActionUrl');

const TIMELINE_FIELDS = new Set(['scheduleDate', 'scheduleSlot', 'startDate', 'dueDate', 'duration']);

const getProjectRole = (project, userId) => {
  if (!project) return null;
  const uid = userId.toString();
  if (project.owner?.toString() === uid) return 'owner';
  const entry = project.memberRoles?.find((r) => r.user?.toString() === uid);
  return entry?.role || (project.members?.some((m) => m.toString() === uid) ? 'member' : null);
};

const canAssignTasks = (project, user) => {
  if (user.role === 'admin') return true;
  const role = getProjectRole(project, user._id);
  return role === 'owner' || role === 'manager';
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
  queueGamificationEvent('TASK_COMPLETED', { userId: user._id, task });

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
      title: `Task Finalized: ${task.title}`,
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

  const [task] = await Task.create([coreData], { session });

  if (assignees && assignees.length > 0) {
    const assignments = assignees.map((userId) => ({
      taskId: task._id,
      userId,
      assignedBy: user._id
    }));
    await TaskAssignment.insertMany(assignments, { session });

    for (const userId of assignees) {
      if (userId.toString() !== user._id.toString()) {
        await createNotification({
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

  const populatedTask = await Task.findById(task._id).session(session)
    .populate('createdBy', 'name avatar')
    .populate({ path: 'assignees', populate: [{ path: 'userId', select: 'name avatar' }, { path: 'assignedBy', select: 'name avatar' }] });

  return mapTaskDTO(populatedTask);
};

exports.getTasks = async (filter) => {
  const tasks = await Task.find(filter)
    .select('title description status priority type scheduleSlot scheduleDate projectId workspace progress dueDate startDate duration plannedHours actualHours createdBy color')
    .populate('projectId', 'name workspace')
    .populate('createdBy', 'name avatar')
    .populate({ path: 'assignees', populate: [{ path: 'userId', select: 'name avatar' }, { path: 'assignedBy', select: 'name avatar' }] });

  return tasks.map(mapTaskDTO);
};

exports.updateTask = async (taskId, updates, user, session) => {
  const existing = await Task.findById(taskId).session(session).populate('assignees');
  if (!existing) throw new Error('Task not found');

  const assignments = existing.assignees || [];
  const isCreator = existing.createdBy?.toString() === user._id.toString();
  const isAssignee = assignments.some((a) => (a.userId?._id || a.userId)?.toString() === user._id.toString());
  const primaryAssignedBy = assignments[0]?.assignedBy?.toString();

  if (!isCreator && !isAssignee && user.role !== 'admin') {
    throw new Error('Not authorized to update this task');
  }

  const { assignees, reviewAction, ...coreUpdates } = updates;

  if (reviewAction === 'approve' || reviewAction === 'rollback') {
    if (primaryAssignedBy !== user._id.toString() && user.role !== 'admin') {
      throw new Error('Only the task assigner can approve or rollback');
    }
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
      || user.role === 'admin';
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

  let dueDateChanged = false;
  const oldDueDate = existing.dueDate;
  if (coreUpdates.dueDate && new Date(coreUpdates.dueDate).getTime() !== new Date(existing.dueDate || 0).getTime()) {
    dueDateChanged = true;
  }

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
    await calculateRollup(task.projectId, task.phaseId, session);
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
      }
    }

    if (reviewAction === 'approve' && task.status === 'done') {
      await finalizeTaskCompletion(task, user, session);
      for (const a of assignments) {
        const assigneeId = a.userId?._id || a.userId;
        if (assigneeId?.toString() !== user._id.toString()) {
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
        }
      }
    }

    if (reviewAction === 'rollback') {
      for (const a of assignments) {
        const assigneeId = a.userId?._id || a.userId;
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

  if (existing.createdBy?.toString() !== user._id.toString() && user.role !== 'admin') {
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

exports.getProjectRole = getProjectRole;
exports.canAssignTasks = canAssignTasks;
