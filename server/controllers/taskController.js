const mongoose = require('mongoose');
const Task = require('../models/Task');
const Project = require('../models/Project');
const TaskService = require('../services/TaskService');
const { isAdminUser } = require('../utils/departmentPermissions');
const { broadcastRealtimeEvent } = require('../config/realtime');

const ALLOWED_CREATE = [
  'title', 'description', 'status', 'priority', 'type', 'scheduleSlot', 'scheduleDate',
  'projectId', 'phaseId', 'parentTaskId', 'assignees', 'startDate', 'dueDate', 'duration',
  'plannedHours', 'actualHours', 'progress', 'dependencies'
];

const ALLOWED_UPDATE = [
  'title', 'description', 'status', 'priority', 'type', 'scheduleSlot', 'scheduleDate',
  'phaseId', 'assignees', 'startDate', 'dueDate', 'duration', 'plannedHours', 'actualHours',
  'progress', 'dependencies', 'reviewAction'
];

const pick = (src, keys) => {
  const r = {};
  for (const k of keys) {
    if (src[k] !== undefined) r[k] = src[k];
  }
  return r;
};

exports.createTask = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const taskData = { ...pick(req.body, ALLOWED_CREATE), createdBy: req.user._id };
    if (!taskData.projectId || taskData.projectId === '[object Object]') delete taskData.projectId;
    
    if (taskData.assignees) {
      taskData.assignees = taskData.assignees.filter(a => typeof a === 'string' && mongoose.Types.ObjectId.isValid(a));
    }

    const taskDto = await TaskService.createTask(taskData, req.user, session);
    
    await session.commitTransaction();
    session.endSession();

    broadcastRealtimeEvent('tasks', 'task_change', { taskId: taskDto._id, action: 'create' });
    broadcastRealtimeEvent('logs', 'log_update', { taskId: taskDto._id, action: 'CREATE_TASK' });
    res.status(201).json(taskDto);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

exports.getTasks = async (req, res, next) => {
  try {
    const { projectId } = req.query;
    const filter = {};

    if (projectId) {
      filter.projectId = projectId;
    } else {
      if (!isAdminUser(req.user)) {
        // Find tasks where user is assignee via TaskAssignment
        const TaskAssignment = require('../models/TaskAssignment');
        const assignments = await TaskAssignment.find({ userId: req.user._id }).lean();
        const taskIds = assignments.map(a => a.taskId);
        
        filter.$or = [
          { createdBy: req.user._id },
          { _id: { $in: taskIds } }
        ];
      }
    }

    const tasksDto = await TaskService.getTasks(filter);
    res.json(tasksDto);
  } catch (error) {
    next(error);
  }
};

exports.updateTask = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id) || req.params.id === '[object Object]') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Invalid task ID format' });
    }

    const updates = pick(req.body, ALLOWED_UPDATE);
    
    const taskDto = await TaskService.updateTask(req.params.id, updates, req.user, session);

    await session.commitTransaction();
    session.endSession();

    broadcastRealtimeEvent('tasks', 'task_change', { taskId: taskDto._id, action: 'update' });
    broadcastRealtimeEvent('logs', 'log_update', { taskId: taskDto._id, action: 'UPDATE_TASK' });
    res.json(taskDto);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    if (error.message.includes('authorized') || error.message.includes('not found')) {
      return res.status(error.message.includes('not found') ? 404 : 403).json({ error: error.message });
    }
    next(error);
  }
};

exports.deleteTask = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id) || req.params.id === '[object Object]') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Invalid task ID format' });
    }

    await TaskService.deleteTask(req.params.id, req.user, session);

    await session.commitTransaction();
    session.endSession();

    broadcastRealtimeEvent('tasks', 'task_change', { taskId: req.params.id, action: 'delete' });
    res.json({ message: 'Task deleted' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    if (error.message.includes('authorized') || error.message.includes('not found')) {
      return res.status(error.message.includes('not found') ? 404 : 403).json({ error: error.message });
    }
    next(error);
  }
};

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
      assignees: [raghavUser._id.toString()],
      createdBy: req.user._id
    };

    const taskDto = await TaskService.createTask(taskData, req.user, session);

    await session.commitTransaction();
    session.endSession();

    broadcastRealtimeEvent('tasks', 'task_change', { taskId: taskDto._id, action: 'create' });
    broadcastRealtimeEvent('logs', 'log_update', { taskId: taskDto._id, action: 'CREATE_TASK' });
    res.status(201).json(taskDto);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};
