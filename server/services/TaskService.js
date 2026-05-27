const mongoose = require('mongoose');
const Task = require('../models/Task');
const TaskAssignment = require('../models/TaskAssignment');
const Project = require('../models/Project');
const Log = require('../models/Log');
const { calculateRollup } = require('../utils/rollup');
const logActivity = require('../utils/activityLogger');
const { queueGamificationEvent } = require('./backgroundQueue');

const mapTaskDTO = (taskDoc) => {
  const task = taskDoc.toObject ? taskDoc.toObject({ virtuals: true }) : taskDoc;
  if (task.assignees && Array.isArray(task.assignees)) {
    // Map TaskAssignment documents back to simple user objects to preserve frontend contract
    task.assignees = task.assignees.map(a => a.userId || a);
  }
  return task;
};

exports.createTask = async (taskData, user, session) => {
  const { assignees, ...coreData } = taskData;
  
  if (coreData.projectId) {
    const proj = await Project.findById(coreData.projectId).session(session);
    if (proj && proj.color) {
      coreData.color = proj.color;
    }
  }

  const [task] = await Task.create([coreData], { session });

  if (assignees && assignees.length > 0) {
    const assignments = assignees.map(userId => ({
      taskId: task._id,
      userId,
      assignedBy: user._id
    }));
    await TaskAssignment.insertMany(assignments, { session });
  }

  if (task.projectId) {
    await Project.findByIdAndUpdate(
      task.projectId,
      { $inc: { totalTasksCount: 1 } },
      { session }
    );
  }

  await logActivity(user._id, 'CREATE_TASK', task._id, 'Task', { title: task.title }, session);

  queueGamificationEvent('TASK_CREATED', {
    userId: user._id,
    task
  });

  const populatedTask = await Task.findById(task._id).session(session)
    .populate('createdBy', 'name avatar')
    .populate({ path: 'assignees', populate: { path: 'userId', select: 'name avatar' } });

  return mapTaskDTO(populatedTask);
};

exports.getTasks = async (filter) => {
  const tasks = await Task.find(filter)
    .select('title description status priority projectId progress dueDate createdBy color')
    .populate('createdBy', 'name avatar')
    .populate({ path: 'assignees', populate: { path: 'userId', select: 'name avatar' } });

  const dtos = tasks.map(mapTaskDTO);
  
  const sw = { 'in-progress': 3, 'todo': 2, 'done': 1 };
  const pw = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
  
  dtos.sort((a, b) => (sw[b.status] || 0) - (sw[a.status] || 0) || (pw[b.priority] || 0) - (pw[a.priority] || 0));
  
  return dtos;
};

exports.updateTask = async (taskId, updates, user, session) => {
  const existing = await Task.findById(taskId).session(session)
    .populate('assignees');

  if (!existing) throw new Error('Task not found');

  const isOwner = existing.createdBy?.toString() === user._id.toString();
  const isAssignee = existing.assignees?.some(a => a.userId?.toString() === user._id.toString() || a.toString() === user._id.toString());
  
  if (!isOwner && !isAssignee && user.role !== 'admin') {
    throw new Error('Not authorized to update this task');
  }

  const { assignees, ...coreUpdates } = updates;

  if (coreUpdates.status) {
    if (coreUpdates.status.toLowerCase() === 'done') {
      coreUpdates.completedAt = new Date();
      coreUpdates.progress = 100;
    } else {
      coreUpdates.completedAt = null;
    }
  }

  let dueDateChanged = false;
  let oldDueDate = existing.dueDate;
  if (coreUpdates.dueDate && new Date(coreUpdates.dueDate).getTime() !== new Date(existing.dueDate).getTime()) {
    dueDateChanged = true;
  }

  const task = await Task.findByIdAndUpdate(taskId, coreUpdates, { new: true, runValidators: true, session });

  let assigneesChanged = false;
  if (assignees) {
    const newAssignees = assignees.map(a => (typeof a === 'object' && a._id) ? a._id.toString() : a.toString());
    const oldAssignees = existing.assignees ? existing.assignees.map(a => (a.userId?._id || a.userId || a).toString()) : [];
    
    if (newAssignees.join(',') !== oldAssignees.join(',')) {
      assigneesChanged = true;
      await TaskAssignment.deleteMany({ taskId: task._id }, { session });
      if (newAssignees.length > 0) {
        const assignments = newAssignees.map(userId => ({
          taskId: task._id,
          userId,
          assignedBy: user._id
        }));
        await TaskAssignment.insertMany(assignments, { session });
      }
    }
  }

  if (task) {
    await calculateRollup(task.projectId, task.phaseId, session);
    await logActivity(user._id, 'UPDATE_TASK', task._id, 'Task', { title: task.title, status: task.status }, session);
    
    if (dueDateChanged) {
      await logActivity(user._id, 'TASK_DATE_CHANGED', task._id, 'Task', { oldDate: oldDueDate, newDate: task.dueDate }, session);
    }
    if (assigneesChanged) {
      await logActivity(user._id, 'TASK_ASSIGNEES_CHANGED', task._id, 'Task', { assignees: assignees }, session);
    }

    if (coreUpdates.status === 'done') {
      queueGamificationEvent('TASK_COMPLETED', {
        userId: user._id,
        task
      });

      let projectName = 'Unassigned';
      if (task.projectId) {
        const projectDoc = await Project.findById(task.projectId).session(session);
        if (projectDoc) {
          projectName = projectDoc.name;
        }
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
    }
  }

  const populatedTask = await Task.findById(task._id).session(session)
    .populate('createdBy', 'name avatar')
    .populate({ path: 'assignees', populate: { path: 'userId', select: 'name avatar' } });

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
