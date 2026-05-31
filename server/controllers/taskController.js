const mongoose = require('mongoose');
const Task = require('../models/Task');
const Project = require('../models/Project');
const TaskService = require('../services/TaskService');
const { createNotification } = require('../services/notificationDispatcher');
const logger = require('../utils/logger');
const { isAdminUser } = require('../utils/departmentPermissions');
const { broadcastRealtimeEvent } = require('../config/realtime');
const { todayStart, todayEnd, getDateKey, startOfDayFromKey, endOfDayFromKey } = require('../utils/attendanceDate');
const { addDays } = require('date-fns');

const dispatchTaskNotifications = (payloads = []) => {
  for (const payload of payloads) {
    createNotification(payload).catch((err) => {
      logger.error('Task', 'Deferred notification failed', { error: err.message });
    });
  }
};

const TECH_PROJECT_ASSIGN_ROLE = 'artist_management';
const TECH_PROJECT_ASSIGN_ROLES = new Set(['owner', 'manager', 'admin', 'artist_management']);

const memberId = (value) => (value?._id || value)?.toString?.() || null;

/** Ensure every user is on the bug/tech project and can assign tasks to the owner. */
const syncTechProjectMembers = async (techProject, ownerId, session) => {
  const User = require('../models/User');
  const allUsers = await User.find({}).select('_id').lean().session(session);
  const ownerStr = memberId(ownerId);

  const memberSet = new Set((techProject.members || []).map(memberId).filter(Boolean));
  const roleMap = new Map(
    (techProject.memberRoles || [])
      .map((entry) => [memberId(entry.user), entry.role])
      .filter(([id]) => id)
  );

  const newMembers = [...(techProject.members || [])];
  const newMemberRoles = (techProject.memberRoles || []).map((entry) => ({
    user: entry.user?._id || entry.user,
    role: entry.role,
  }));

  let changed = false;

  for (const u of allUsers) {
    const uid = u._id.toString();
    if (!memberSet.has(uid)) {
      newMembers.push(u._id);
      memberSet.add(uid);
      changed = true;
    }
    if (uid === ownerStr) continue;
    const currentRole = roleMap.get(uid);
    if (!currentRole || !TECH_PROJECT_ASSIGN_ROLES.has(currentRole)) {
      const existingIdx = newMemberRoles.findIndex((r) => memberId(r.user) === uid);
      if (existingIdx >= 0) {
        if (newMemberRoles[existingIdx].role !== TECH_PROJECT_ASSIGN_ROLE) {
          newMemberRoles[existingIdx].role = TECH_PROJECT_ASSIGN_ROLE;
          changed = true;
        }
      } else {
        newMemberRoles.push({ user: u._id, role: TECH_PROJECT_ASSIGN_ROLE });
        roleMap.set(uid, TECH_PROJECT_ASSIGN_ROLE);
        changed = true;
      }
    }
  }

  if (!changed) return techProject;

  return Project.findByIdAndUpdate(
    techProject._id,
    { members: newMembers, memberRoles: newMemberRoles },
    { new: true, session }
  ) || techProject;
};

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

    const { taskDto, pendingNotifications } = await TaskService.createTask(taskData, req.user, session);

    await session.commitTransaction();
    session.endSession();

    dispatchTaskNotifications(pendingNotifications);
    broadcastRealtimeEvent('tasks', 'task_change', { taskId: taskDto._id, action: 'create' });
    broadcastRealtimeEvent('logs', 'log_update', { taskId: taskDto._id, action: 'CREATE_TASK' });
    res.status(201).json(taskDto);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    if (error.message?.includes('authorized') || error.message?.includes('not found')) {
      return res.status(error.message.includes('not found') ? 404 : 403).json({ error: error.message });
    }
    next(error);
  }
};

exports.getTasks = async (req, res, next) => {
  try {
    const { projectId, scope } = req.query;

    if (scope === 'review') {
      const reviewTasks = await TaskService.getReviewQueue(req.user);
      return res.json(reviewTasks);
    }

    const filter = {};

    if (projectId) {
      filter.projectId = projectId;
    } else {
      if (!isAdminUser(req.user)) {
        const TaskAssignment = require('../models/TaskAssignment');
        const assignments = await TaskAssignment.find({ userId: req.user._id }).lean();
        const taskIds = assignments.map(a => a.taskId);

        filter.$or = [
          { createdBy: req.user._id },
          { _id: { $in: taskIds } }
        ];
      }
    }

    if (scope === 'dashboard') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const futureLimit = new Date(today.getTime() + 35 * 24 * 60 * 60 * 1000); // 35 days ahead

      filter.status = { $nin: ['done', 'in-review'] };
      filter.$expr = {
        $let: {
          vars: { taskDay: { $ifNull: ['$scheduleDate', '$dueDate'] } },
          in: {
            $and: [
              { $ne: ['$$taskDay', null] },
              { $lt: ['$$taskDay', futureLimit] },
            ],
          },
        },
      };
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

/** Calculate due date based on bug severity using IST timezone */
const calculateBugDueDate = (severity) => {
  const today = startOfDayFromKey(getDateKey());
  const now = new Date();
  
  switch (severity) {
    case 'critical':
      // Critical: NOW (same day, current time)
      return now;
    
    case 'high':
      // High: TODAY 2:00 PM IST (14:00)
      const todayPM = new Date(today);
      todayPM.setHours(14, 0, 0, 0);
      // If it's already past 2 PM, use tomorrow 2 PM
      if (todayPM < now) {
        const tomorrowStart = startOfDayFromKey(getDateKey(addDays(today, 1)));
        const tomorrowPM = new Date(tomorrowStart);
        tomorrowPM.setHours(14, 0, 0, 0);
        return tomorrowPM;
      }
      return todayPM;
    
    case 'medium':
      // Medium: TOMORROW 9:00 AM IST (09:00)
      const tomorrow = addDays(today, 1);
      const tomorrowAM = new Date(startOfDayFromKey(getDateKey(tomorrow)));
      tomorrowAM.setHours(9, 0, 0, 0);
      return tomorrowAM;
    
    case 'low':
    default:
      // Low: DAY AFTER TOMORROW 9:00 AM IST (09:00)
      const dayAfter = addDays(today, 2);
      const dayAfterAM = new Date(startOfDayFromKey(getDateKey(dayAfter)));
      dayAfterAM.setHours(9, 0, 0, 0);
      return dayAfterAM;
  }
};

exports.reportBug = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { page, title, description, severity } = req.body;
    if (!title?.trim()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Title is required' });
    }

    const details = description?.trim() || '(No details provided)';

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

    techProject = await syncTechProjectMembers(techProject, raghavUser._id, session);

    const taskData = {
      title: `[BUG] ${title} (${page || 'General'})`,
      description: `**Reported View/Page:** ${page || 'General'}\n**Severity:** ${severity || 'medium'}\n\n**Issue Details:**\n${details}\n\n*Reported by:* ${req.user.name} (${req.user.email})`,
      status: 'todo',
      priority: severity === 'blocker' || severity === 'high' ? 'critical' : severity === 'medium' ? 'high' : 'medium',
      projectId: techProject._id,
      assignees: [raghavUser._id.toString()],
      createdBy: req.user._id,
      dueDate: calculateBugDueDate(severity),
      scheduleSlot: severity === 'high' ? 'PM' : 'AM'
    };

    const { taskDto, pendingNotifications } = await TaskService.createTask(taskData, req.user, session);

    await session.commitTransaction();
    session.endSession();

    dispatchTaskNotifications(pendingNotifications);
    broadcastRealtimeEvent('tasks', 'task_change', { taskId: taskDto._id, action: 'create' });
    broadcastRealtimeEvent('logs', 'log_update', { taskId: taskDto._id, action: 'CREATE_TASK' });
    res.status(201).json(taskDto);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    if (error.message?.includes('authorized')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
};
