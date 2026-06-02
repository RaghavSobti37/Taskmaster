/**
 * Task HTTP layer. Review/approve rules live in TaskService + shared/taskReviewRules.js —
 * keep client taskReview.js aligned with that shared module.
 */
const mongoose = require('mongoose');
const Task = require('../models/Task');
const Project = require('../models/Project');
const TaskService = require('../services/TaskService');
const { createNotification } = require('../services/notificationDispatcher');
const logger = require('../utils/logger');
const { isAdminUser } = require('../utils/departmentPermissions');
const { withTransactionRetry } = require('../utils/mongoTransaction');
const { scheduleRollup } = require('../utils/rollup');
const { broadcastRealtimeEvent } = require('../config/realtime');
const { getDateKey, APP_TIMEZONE } = require('../utils/attendanceDate');

const BUG_SEVERITIES = new Set(['critical', 'high', 'medium', 'low']);
const TZ_OFFSET = APP_TIMEZONE === 'UTC' ? '+00:00' : '+05:30';

const normalizeBugSeverity = (severity) => (
  BUG_SEVERITIES.has(String(severity || '').toLowerCase()) ? String(severity).toLowerCase() : 'medium'
);

const istDateTime = (dateKey, hour, minute = 0) => {
  const h = String(hour).padStart(2, '0');
  const m = String(minute).padStart(2, '0');
  return new Date(`${dateKey}T${h}:${m}:00${TZ_OFFSET}`);
};

const addDaysToDateKey = (dateKey, days) => {
  const anchor = new Date(`${dateKey}T12:00:00${TZ_OFFSET}`);
  anchor.setDate(anchor.getDate() + days);
  return getDateKey(anchor);
};

const mapSeverityToPriority = (severity) => {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'critical';
    case 'medium':
      return 'high';
    case 'low':
    default:
      return 'medium';
  }
};

const mapSeverityToScheduleSlot = (severity) => {
  switch (severity) {
    case 'critical':
      return 'FULL';
    case 'high':
      return 'PM';
    case 'medium':
    case 'low':
    default:
      return 'AM';
  }
};

const dispatchTaskNotifications = (payloads = []) => {
  for (const payload of payloads) {
    createNotification(payload).catch((err) => {
      logger.error('Task', 'Deferred notification failed', { error: err.message });
    });
  }
};

const TECH_PROJECT_ASSIGN_ROLE = 'artist_management';
const TECH_PROJECT_ASSIGN_ROLES = new Set(['admin', 'manager', 'artist_management', 'owner']);

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
  'projectId', 'workspace', 'phaseId', 'assignees', 'startDate', 'dueDate', 'duration',
  'plannedHours', 'actualHours', 'progress', 'dependencies', 'reviewAction'
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
  try {
    let taskDto, pendingNotifications;
    await session.withTransaction(async () => {
      const taskData = { ...pick(req.body, ALLOWED_CREATE), createdBy: req.user._id };
      if (!taskData.projectId || taskData.projectId === '[object Object]') delete taskData.projectId;
      
      if (taskData.assignees) {
        taskData.assignees = taskData.assignees.filter(a => typeof a === 'string' && mongoose.Types.ObjectId.isValid(a));
      }

      const result = await TaskService.createTask(taskData, req.user, session);
      taskDto = result.taskDto;
      pendingNotifications = result.pendingNotifications;
    });

    dispatchTaskNotifications(pendingNotifications);
    broadcastRealtimeEvent('tasks', 'task_change', { taskId: taskDto._id, action: 'create' });
    broadcastRealtimeEvent('logs', 'log_update', { taskId: taskDto._id, action: 'CREATE_TASK' });
    res.status(201).json(taskDto);
  } catch (error) {
    if (error.message?.includes('cannot be in the past') || error.message?.includes('Invalid start date')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message?.includes('authorized') || error.message?.includes('not found')) {
      return res.status(error.message.includes('not found') ? 404 : 403).json({ error: error.message });
    }
    next(error);
  } finally {
    session.endSession();
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
      if (!isAdminUser(req.user)) {
        const Project = require('../models/Project');
        const project = await Project.findById(projectId).lean();
        const { getProjectRole } = require('../services/TaskService');
        const role = getProjectRole(project, req.user._id);
        if (!role) {
          return res.status(403).json({ error: 'Not authorized to view tasks for this project' });
        }
      }
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
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id) || req.params.id === '[object Object]') {
      return res.status(400).json({ error: 'Invalid task ID format' });
    }

    const updates = pick(req.body, ALLOWED_UPDATE);
    let taskDto;
    let pendingNotifications = [];
    let rollupMeta = null;

    await withTransactionRetry(session, async () => {
      const result = await TaskService.updateTask(req.params.id, updates, req.user, session);
      taskDto = result.taskDto;
      pendingNotifications = result.pendingNotifications || [];
      rollupMeta = result.rollupMeta || null;
    });

    dispatchTaskNotifications(pendingNotifications);
    if (rollupMeta?.previousProjectId) {
      scheduleRollup(rollupMeta.previousProjectId, null);
    }
    if (rollupMeta?.projectId) {
      scheduleRollup(rollupMeta.projectId, rollupMeta.phaseId);
    }

    broadcastRealtimeEvent('tasks', 'task_change', { taskId: taskDto._id, action: 'update' });
    broadcastRealtimeEvent('logs', 'log_update', { taskId: taskDto._id, action: 'UPDATE_TASK' });
    res.json(taskDto);
  } catch (error) {
    if (
      error.message?.includes('cannot be in the past')
      || error.message?.includes('Invalid start date')
      || error.message?.includes('Invalid due date')
    ) {
      return res.status(400).json({ error: error.message });
    }
    if (
      error.message?.includes('authorized')
      || error.message?.includes('not found')
      || error.message?.includes('Invalid project')
      || error.message?.includes('creator or assigner')
      || error.message?.includes('assigned this task')
    ) {
      const status = error.message.includes('not found') ? 404 : 403;
      return res.status(status).json({ error: error.message });
    }
    next(error);
  } finally {
    session.endSession();
  }
};

exports.deleteTask = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id) || req.params.id === '[object Object]') {
      return res.status(400).json({ error: 'Invalid task ID format' });
    }

    await session.withTransaction(async () => {
      await TaskService.deleteTask(req.params.id, req.user, session);
    });

    broadcastRealtimeEvent('tasks', 'task_change', { taskId: req.params.id, action: 'delete' });
    res.json({ message: 'Task deleted' });
  } catch (error) {
    if (error.message?.includes('authorized') || error.message?.includes('not found')) {
      return res.status(error.message.includes('not found') ? 404 : 403).json({ error: error.message });
    }
    next(error);
  } finally {
    session.endSession();
  }
};

/** Calculate due date based on bug severity using app timezone (default IST). */
const calculateBugDueDate = (severity) => {
  const now = new Date();
  const todayKey = getDateKey(now);

  switch (severity) {
    case 'critical':
      return now;

    case 'high': {
      const todayPmDue = istDateTime(todayKey, 14, 0);
      if (todayPmDue <= now) {
        return istDateTime(addDaysToDateKey(todayKey, 1), 14, 0);
      }
      return todayPmDue;
    }

    case 'medium':
      return istDateTime(addDaysToDateKey(todayKey, 1), 9, 0);

    case 'low':
    default:
      return istDateTime(addDaysToDateKey(todayKey, 2), 9, 0);
  }
};

exports.reportBug = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { page, title, description, severity: rawSeverity } = req.body;
    if (!title?.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const severity = normalizeBugSeverity(rawSeverity);
    let taskDto, pendingNotifications;

    await session.withTransaction(async () => {
      const details = description?.trim() || '(No details provided)';

      const User = require('../models/User');
      const raghavUser = await User.findOne({ email: 'REDACTED_ADMIN@example.com' }).session(session) || req.user;

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
        description: `**Reported View/Page:** ${page || 'General'}\n**Severity:** ${severity}\n\n**Issue Details:**\n${details}\n\n*Reported by:* ${req.user.name} (${req.user.email})`,
        status: 'todo',
        priority: mapSeverityToPriority(severity),
        projectId: techProject._id,
        assignees: [raghavUser._id.toString()],
        createdBy: req.user._id,
        dueDate: calculateBugDueDate(severity),
        scheduleSlot: mapSeverityToScheduleSlot(severity)
      };

      const result = await TaskService.createTask(taskData, req.user, session);
      taskDto = result.taskDto;
      pendingNotifications = result.pendingNotifications;
    });

    dispatchTaskNotifications(pendingNotifications);
    broadcastRealtimeEvent('tasks', 'task_change', { taskId: taskDto._id, action: 'create' });
    broadcastRealtimeEvent('logs', 'log_update', { taskId: taskDto._id, action: 'CREATE_TASK' });
    res.status(201).json(taskDto);
  } catch (error) {
    if (error.message?.includes('authorized')) {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  } finally {
    session.endSession();
  }
};
