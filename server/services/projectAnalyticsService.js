const mongoose = require('mongoose');
const Project = require('../models/Project');
const Task = require('../models/Task');
const TaskAssignment = require('../models/TaskAssignment');
const Log = require('../models/Log');
const User = require('../models/User');
const { parseTimeSpentToHours } = require('../../shared/timeSpent');
const { resolveRollingRange, inRollingWindow } = require('../../shared/reportRange');
const { getDateKey, startOfDayFromKey, endOfDayFromKey } = require('../utils/attendanceDate');
const { isAdminUser } = require('../utils/departmentPermissions');
const { canAccessProject, getAccessibleProjectsFilter } = require('../utils/projectAccess');

const TASK_LOG_TYPES = new Set(['TASK_COMPLETION', 'TASK_REVIEW']);
const roundHours = (n) => Math.round(n * 100) / 100;

const emptyPriorityCounts = () => ({ critical: 0, high: 0, medium: 0, low: 0 });

const buildProjectLogFilter = (project, rangeStart, rangeEnd) => ({
  action: 'DAILY_LOG',
  createdAt: { $gte: rangeStart, $lte: rangeEnd },
  $or: [
    { targetId: project._id, targetType: 'Project' },
    { 'details.projectId': project._id },
    { 'details.project': project.name },
  ],
});

const resolveLogUserId = (log) => {
  const uid = log.userId?.toString?.() || log.userId;
  if (uid) return uid;
  const actor = log.actorId?.toString?.() || log.actorId;
  if (actor && mongoose.isValidObjectId(actor)) return actor;
  return null;
};

const formatLogEntry = (log, profile) => {
  const created = log.createdAt || log.timestamp;
  const d = new Date(created);
  const pad = (n) => String(n).padStart(2, '0');
  const name = typeof profile === 'string' ? profile : (profile?.name || '');
  const avatar = typeof profile === 'object' && profile ? (profile.avatar || '') : '';
  return {
    userId: resolveLogUserId(log),
    userName: name,
    userAvatar: avatar,
    date: getDateKey(d),
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    title: log.details?.title || log.payload?.title || 'Untitled',
    project: log.details?.project || log.payload?.project || '',
    timeSpent: log.details?.timeSpent || log.payload?.timeSpent || '0m',
    message: log.details?.message || log.payload?.message || '',
    type: log.details?.type || log.payload?.type || '',
  };
};

const isTaskCompletionLog = (log) => TASK_LOG_TYPES.has(log.details?.type || log.payload?.type);

const logHours = (log) => parseTimeSpentToHours(log.details?.timeSpent || log.payload?.timeSpent);

const taskActiveInRange = (task, rangeStart, rangeEnd) => {
  const refs = [task.completedAt, task.updatedAt, task.dueDate, task.scheduleDate, task.createdAt].filter(Boolean);
  return refs.some((ref) => {
    const d = new Date(ref);
    return d >= rangeStart && d <= rangeEnd;
  });
};

const taskCompletedInRange = (task, rangeStart, rangeEnd) => {
  if (task.status !== 'done') return false;
  const ref = task.completedAt || task.updatedAt;
  if (!ref) return false;
  const d = new Date(ref);
  return d >= rangeStart && d <= rangeEnd;
};

const buildAnalyticsForProject = async (project, window, memberProfileById = new Map()) => {
  const rangeStart = startOfDayFromKey(window.startKey);
  const rangeEnd = endOfDayFromKey(window.endKey);

  const [logs, tasks] = await Promise.all([
    Log.find(buildProjectLogFilter(project, rangeStart, rangeEnd))
      .sort({ createdAt: -1 })
      .lean(),
    Task.find({ projectId: project._id })
      .select('title status priority actualHours plannedHours completedAt updatedAt dueDate scheduleDate createdAt')
      .lean(),
  ]);

  const taskIds = tasks.map((t) => t._id);
  const projectAssignments = taskIds.length
    ? await TaskAssignment.find({ taskId: { $in: taskIds } }).lean()
    : [];

  const assigneesByTask = new Map();
  projectAssignments.forEach((a) => {
    const tid = a.taskId?.toString();
    const uid = a.userId?.toString();
    if (!tid || !uid) return;
    if (!assigneesByTask.has(tid)) assigneesByTask.set(tid, []);
    assigneesByTask.get(tid).push(uid);
  });

  const extraUserIds = new Set();
  projectAssignments.forEach((a) => {
    const uid = a.userId?.toString();
    if (uid) extraUserIds.add(uid);
  });
  logs.forEach((log) => {
    const uid = resolveLogUserId(log);
    if (uid) extraUserIds.add(uid);
  });
  const missingProfileIds = [...extraUserIds].filter((id) => !memberProfileById.has(id));
  if (missingProfileIds.length) {
    const extraUsers = await User.find({ _id: { $in: missingProfileIds } }).select('name avatar').lean();
    extraUsers.forEach((u) => {
      memberProfileById.set(u._id.toString(), { name: u.name, avatar: u.avatar || '' });
    });
  }

  const byDayMap = new Map();
  const memberMap = new Map();

  const ensureMember = (uid) => {
    if (!uid) return null;
    if (!memberMap.has(uid)) {
      const profile = memberProfileById.get(uid);
      memberMap.set(uid, {
        userId: uid,
        name: profile?.name || 'Unknown',
        avatar: profile?.avatar || '',
        hours: 0,
        manualHours: 0,
        taskHours: 0,
        logCount: 0,
        tasksCompleted: 0,
        tasksByPriority: emptyPriorityCounts(),
      });
    }
    return memberMap.get(uid);
  };

  const addTaskPriorityForAssignees = (task) => {
    const assignees = assigneesByTask.get(task._id.toString()) || [];
    const priority = task.priority || 'medium';
    assignees.forEach((uid) => {
      const member = ensureMember(uid);
      if (!member) return;
      if (member.tasksByPriority[priority] !== undefined) {
        member.tasksByPriority[priority] += 1;
      } else {
        member.tasksByPriority.medium += 1;
      }
    });
  };

  let manualLogHours = 0;
  let taskCompletionHours = 0;

  logs.forEach((log) => {
    const day = getDateKey(log.createdAt || log.timestamp);
    if (!inRollingWindow(day, window)) return;

    const hours = logHours(log);
    const isTaskLog = isTaskCompletionLog(log);
    if (isTaskLog) taskCompletionHours += hours;
    else manualLogHours += hours;

    const dayRow = byDayMap.get(day) || { date: day, hours: 0, manualHours: 0, taskHours: 0, logCount: 0 };
    dayRow.hours += hours;
    dayRow.logCount += 1;
    if (isTaskLog) dayRow.taskHours += hours;
    else dayRow.manualHours += hours;
    byDayMap.set(day, dayRow);

    const uid = resolveLogUserId(log);
    const member = ensureMember(uid);
    if (member) {
      member.hours += hours;
      member.logCount += 1;
      if (isTaskLog) member.taskHours += hours;
      else member.manualHours += hours;
    }
  });

  const tasksInRange = tasks.filter((t) => taskActiveInRange(t, rangeStart, rangeEnd));
  const completedInRange = tasks.filter((t) => taskCompletedInRange(t, rangeStart, rangeEnd));

  const byStatus = { done: 0, inProgress: 0, todo: 0, inReview: 0 };
  const byPriority = { critical: 0, high: 0, medium: 0, low: 0 };

  tasksInRange.forEach((task) => {
    if (task.status === 'done') byStatus.done += 1;
    else if (task.status === 'in-progress') byStatus.inProgress += 1;
    else if (task.status === 'in-review') byStatus.inReview += 1;
    else byStatus.todo += 1;

    const p = task.priority || 'medium';
    if (byPriority[p] !== undefined) byPriority[p] += 1;
    else byPriority.medium += 1;

    addTaskPriorityForAssignees(task);
  });

  completedInRange.forEach((task) => {
    const assignees = assigneesByTask.get(task._id.toString()) || [];
    assignees.forEach((uid) => {
      const member = ensureMember(uid);
      if (member) member.tasksCompleted += 1;
    });
  });

  const plannedHours = roundHours(
    tasksInRange.reduce((s, t) => s + (t.plannedHours || 0), 0)
  );

  const totalHours = roundHours(manualLogHours + taskCompletionHours);
  manualLogHours = roundHours(manualLogHours);
  taskCompletionHours = roundHours(taskCompletionHours);

  const byDay = [...byDayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  const byMember = [...memberMap.values()].sort((a, b) => b.hours - a.hours);

  const hoursMix = [
    { name: 'Manual logs', value: manualLogHours },
    { name: 'Task completion', value: taskCompletionHours },
  ].filter((d) => d.value > 0);

  const memberIds = [...new Set((project.members || []).map((m) => m.toString()))];
  memberIds.forEach((uid) => ensureMember(uid));

  const recentLogs = logs
    .slice(0, 50)
    .map((log) => {
      const uid = resolveLogUserId(log);
      return formatLogEntry(log, memberProfileById.get(uid) || { name: '', avatar: '' });
    });

  return {
    project: {
      _id: project._id,
      name: project.name,
      status: project.status,
      progress: project.progress,
      workspace: project.workspace,
    },
    window: {
      start: window.startKey,
      end: window.endKey,
      days: window.days,
      timeframe: window.timeframe,
    },
    summary: {
      totalHours,
      manualLogHours,
      taskCompletionHours,
      plannedHours,
      logEntries: logs.length,
      tasksCompleted: completedInRange.length,
      tasksTotal: tasksInRange.length,
      tasksInProgress: byStatus.inProgress + byStatus.inReview,
    },
    byDay,
    byMember,
    byStatus,
    byPriority,
    hoursMix,
    recentLogs,
  };
};

const loadMemberProfiles = async (projects) => {
  const ids = new Set();
  projects.forEach((p) => {
    (p.members || []).forEach((m) => ids.add(m.toString()));
    if (p.owner) ids.add(p.owner.toString());
  });
  if (!ids.size) return new Map();
  const users = await User.find({ _id: { $in: [...ids] } }).select('name avatar').lean();
  return new Map(users.map((u) => [u._id.toString(), { name: u.name, avatar: u.avatar || '' }]));
};

const buildProjectAnalytics = async (projectId, user, rangeQuery = {}) => {
  const project = await Project.findById(projectId).lean();
  if (!project) {
    const err = new Error('Project not found');
    err.status = 404;
    throw err;
  }
  if (!canAccessProject(user, project)) {
    const err = new Error('Not authorized to view this project analytics');
    err.status = 403;
    throw err;
  }

  const window = resolveRollingRange(rangeQuery);
  const memberProfileById = await loadMemberProfiles([project]);
  return buildAnalyticsForProject(project, window, memberProfileById);
};

const buildProjectsAnalyticsSummary = async (user, rangeQuery = {}) => {
  const window = resolveRollingRange(rangeQuery);
  const rangeStart = startOfDayFromKey(window.startKey);
  const rangeEnd = endOfDayFromKey(window.endKey);

  const projects = await Project.find(getAccessibleProjectsFilter(user))
    .select('name owner members')
    .lean();

  if (!projects.length) {
    return { window: { start: window.startKey, end: window.endKey, days: window.days, timeframe: window.timeframe }, projects: [] };
  }

  const projectIds = projects.map((p) => p._id);
  const projectById = Object.fromEntries(projects.map((p) => [p._id.toString(), p]));

  const logs = await Log.find({
    action: 'DAILY_LOG',
    createdAt: { $gte: rangeStart, $lte: rangeEnd },
    $or: [
      { targetId: { $in: projectIds }, targetType: 'Project' },
      { 'details.projectId': { $in: projectIds } },
      { 'details.project': { $in: projects.map((p) => p.name) } },
    ],
  }).select('details userId actorId createdAt targetId targetType').lean();

  const tasks = await Task.find({ projectId: { $in: projectIds } })
    .select('projectId status completedAt updatedAt')
    .lean();

  const summaries = projects.map((p) => ({
    projectId: p._id,
    totalHours: 0,
    manualLogHours: 0,
    taskCompletionHours: 0,
    logCount: 0,
    tasksCompleted: 0,
  }));

  const summaryByProjectId = Object.fromEntries(summaries.map((s) => [s.projectId.toString(), s]));

  const matchLogToProjectId = (log) => {
    const detailPid = log.details?.projectId?.toString?.() || log.details?.projectId;
    if (detailPid && projectById[detailPid]) return detailPid;
    const target = log.targetId?.toString?.();
    if (target && projectById[target]) return target;
    const name = log.details?.project;
    if (name) {
      const found = projects.find((p) => p.name === name);
      if (found) return found._id.toString();
    }
    return null;
  };

  logs.forEach((log) => {
    const pid = matchLogToProjectId(log);
    if (!pid || !summaryByProjectId[pid]) return;
    const row = summaryByProjectId[pid];
    const hours = logHours(log);
    const isTaskLog = isTaskCompletionLog(log);
    row.logCount += 1;
    if (isTaskLog) row.taskCompletionHours += hours;
    else row.manualLogHours += hours;
    row.totalHours += hours;
  });

  tasks.forEach((task) => {
    if (!taskCompletedInRange(task, rangeStart, rangeEnd)) return;
    const pid = task.projectId?.toString();
    if (pid && summaryByProjectId[pid]) {
      summaryByProjectId[pid].tasksCompleted += 1;
    }
  });

  Object.values(summaryByProjectId).forEach((row) => {
    row.totalHours = roundHours(row.totalHours);
    row.manualLogHours = roundHours(row.manualLogHours);
    row.taskCompletionHours = roundHours(row.taskCompletionHours);
  });

  return {
    window: {
      start: window.startKey,
      end: window.endKey,
      days: window.days,
      timeframe: window.timeframe,
    },
    projects: summaries,
  };
};

module.exports = {
  buildProjectAnalytics,
  buildProjectsAnalyticsSummary,
  canAccessProject,
};
