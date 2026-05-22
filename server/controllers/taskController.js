const mongoose = require('mongoose');
const Task = require('../models/Task');
const Project = require('../models/Project');
const Log = require('../models/Log');
const { calculateRollup } = require('../utils/rollup');
const logActivity = require('../utils/activityLogger');

const ALLOWED_CREATE = [
  'title', 'description', 'status', 'priority', 'projectId', 'phaseId',
  'parentTaskId', 'assignees', 'startDate', 'dueDate', 'duration',
  'plannedHours', 'actualHours', 'progress', 'dependencies'
];

const ALLOWED_UPDATE = [
  'title', 'description', 'status', 'priority', 'phaseId', 'assignees',
  'startDate', 'dueDate', 'duration', 'plannedHours', 'actualHours',
  'progress', 'dependencies'
];

/**
 * Helper utility to filter an object based on allowed keys.
 * @param {Object} src - Source object containing incoming properties.
 * @param {Array<string>} keys - Whitelisted property names.
 * @returns {Object} Sanitized object containing only allowed properties.
 */
const pick = (src, keys) => {
  const r = {};
  for (const k of keys) {
    if (src[k] !== undefined) r[k] = src[k];
  }
  return r;
};

/**
 * Creates a new task and atomically increments project task counts and logs activity.
 * @async
 * @param {Object} req - Express request object containing body payload and authenticated user.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function for error handling.
 * @returns {Promise<void>} Sends 201 status with the newly created task document.
 */
exports.createTask = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const taskData = { ...pick(req.body, ALLOWED_CREATE), createdBy: req.user._id };
    if (!taskData.projectId) delete taskData.projectId;

    const [task] = await Task.create([taskData], { session });

    if (task.projectId) {
      await Project.findByIdAndUpdate(
        task.projectId,
        { $inc: { totalTasksCount: 1 } },
        { session }
      );
    }

    await logActivity(req.user._id, 'CREATE_TASK', task._id, 'Task', { title: task.title }, session);

    await session.commitTransaction();
    session.endSession();

    res.status(201).json(task);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

/**
 * Retrieves tasks filtered by user and optional project ID with sorted priority.
 * @async
 * @param {Object} req - Express request object containing query parameters.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function for error handling.
 * @returns {Promise<void>} Sends JSON array of task objects.
 */
exports.getTasks = async (req, res, next) => {
  try {
    const { projectId } = req.query;
    const filter = {};

    if (projectId) {
      filter.projectId = projectId;
    } else {
      if (req.user.role !== 'admin') {
        filter.$or = [
          { createdBy: req.user._id },
          { assignees: req.user._id }
        ];
      }
    }

    const tasks = await Task.find(filter)
      .select('title status priority projectId assignees progress dueDate')
      .populate('assignees', 'name avatar')
      .lean();

    const sw = { 'in-progress': 3, 'todo': 2, 'done': 1 };
    const pw = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };

    tasks.sort((a, b) => (sw[b.status] || 0) - (sw[a.status] || 0) || (pw[b.priority] || 0) - (pw[a.priority] || 0));

    res.json(tasks);
  } catch (error) {
    next(error);
  }
};

/**
 * Updates an existing task, recalculates progress rollups, logs activity, and handles task completion workflows atomically.
 * @async
 * @param {Object} req - Express request object containing params.id and update payload.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function for error handling.
 * @returns {Promise<void>} Sends JSON object of the updated task document.
 */
exports.updateTask = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const existing = await Task.findById(req.params.id).session(session);
    if (!existing) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: 'Task not found' });
    }

    const isOwner = existing.createdBy?.toString() === req.user._id.toString();
    const isAssignee = existing.assignees?.some(a => a.toString() === req.user._id.toString());
    if (!isOwner && !isAssignee && req.user.role !== 'admin') {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ error: 'Not authorized to update this task' });
    }

    const updates = pick(req.body, ALLOWED_UPDATE);
    if (updates.status) {
      if (updates.status.toLowerCase() === 'done') {
        updates.completedAt = new Date();
        updates.progress = 100;
      } else {
        updates.completedAt = null;
      }
    }

    const task = await Task.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true, session })
      .populate('assignees', 'name avatar');

    if (task) {
      // Execute post-update side effects inside the atomic transaction
      await calculateRollup(task.projectId, task.phaseId, session);
      await logActivity(req.user._id, 'UPDATE_TASK', task._id, 'Task', { title: task.title, status: task.status }, session);

      // Handle daily log creation on task completion
      if (updates.status === 'done') {
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

        const logDetails = {
          type: 'TASK_COMPLETION',
          title: `Task Finalized: ${task.title}`,
          message: `Successfully completed task within ${projectName}.`,
          project: projectName,
          timeSpent: timeSpentStr
        };

        await Log.create([{
          userId: req.user._id,
          action: 'DAILY_LOG',
          details: logDetails,
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

    await session.commitTransaction();
    session.endSession();

    res.json(task);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

/**
 * Deletes a task and atomically decrements associated project task metrics.
 * @async
 * @param {Object} req - Express request object containing params.id.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function for error handling.
 * @returns {Promise<void>} Sends success confirmation message.
 */
exports.deleteTask = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const existing = await Task.findById(req.params.id).session(session);
    if (!existing) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: 'Task not found' });
    }

    if (existing.createdBy?.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ error: 'Not authorized to delete this task' });
    }

    const task = await Task.findByIdAndDelete(req.params.id, { session });
    if (task) {
      if (task.projectId) {
        const dec = { totalTasksCount: -1 };
        if (task.status === 'done') dec.completedTasksCount = -1;
        await Project.findByIdAndUpdate(task.projectId, { $inc: dec }, { session });
      }
      await logActivity(req.user._id, 'DELETE_TASK', task._id, 'Task', { title: task.title }, session);
    }

    await session.commitTransaction();
    session.endSession();

    res.json({ message: 'Task deleted' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

/**
 * Reports a platform bug or issue, automatically assigning it as a task under the Tech Stack project for Raghav.
 * @async
 */
exports.reportBug = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { page, title, description, severity } = req.body;
    if (!title || !description) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Title and description are required' });
    }

    const User = require('../models/User');
    const raghavUser = await User.findOne({ email: 'raghavraj@theshakticollective.in' }).session(session) || req.user;

    // Find or create Tech Project
    let techProject = await Project.findOne({ name: /tech|maintenance/i }).session(session);
    if (!techProject) {
      techProject = await Project.create([{
        name: 'Tech Stack & Maintenance',
        description: 'Core application infrastructure, bug tracking, and continuous refactoring pipeline.',
        status: 'active',
        outletId: 'coreknot',
        owner: raghavUser._id,
        members: [raghavUser._id],
        memberRoles: [{ user: raghavUser._id, role: 'manager' }]
      }], { session });
      techProject = techProject[0];
    }

    const taskData = {
      title: `[BUG] ${title} (${page || 'General'})`,
      description: `**Reported View/Page:** ${page || 'General'}\n**Severity:** ${severity || 'medium'}\n\n**Issue Details:**\n${description}\n\n*Reported by:* ${req.user.name} (${req.user.email})`,
      status: 'todo',
      priority: severity === 'blocker' || severity === 'high' ? 'critical' : severity === 'medium' ? 'high' : 'medium',
      projectId: techProject._id,
      assignees: [raghavUser._id],
      createdBy: req.user._id
    };

    const [task] = await Task.create([taskData], { session });

    await Project.findByIdAndUpdate(
      techProject._id,
      { $inc: { totalTasksCount: 1 } },
      { session }
    );

    await logActivity(req.user._id, 'REPORT_BUG', task._id, 'Task', { title: task.title, severity }, session);

    await session.commitTransaction();
    session.endSession();

    res.status(201).json(task);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};
