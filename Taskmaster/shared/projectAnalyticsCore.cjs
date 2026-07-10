/** CJS entry for Node — keep in sync with projectAnalyticsCore.js */
const { parseTimeSpentToHours } = require('./timeSpent');

const TASK_LOG_TYPES = new Set(['TASK_COMPLETION', 'TASK_REVIEW']);
const roundHours = (n) => Math.round(n * 100) / 100;

const emptyPriorityCounts = () => ({ critical: 0, high: 0, medium: 0, low: 0 });

function resolveLogUserId(log) {
  const uid = log.userId?.toString?.() || log.userId;
  if (uid) return String(uid);
  const actor = log.actorId?.toString?.() || log.actorId;
  if (actor && /^[a-f0-9]{24}$/i.test(String(actor))) return String(actor);
  return null;
}

function logDetailType(log) {
  return log.details?.type || log.payload?.type || '';
}

function isTaskCompletionLog(log) {
  return TASK_LOG_TYPES.has(logDetailType(log));
}

function logHours(log) {
  return parseTimeSpentToHours(log.details?.timeSpent || log.payload?.timeSpent);
}

function buildAnalyticsContext(projects, tasks = []) {
  const projectById = new Map();
  const projectByName = new Map();
  (projects || []).forEach((p) => {
    const id = p._id?.toString?.() || String(p._id);
    projectById.set(id, p);
    const name = (p.name || '').trim();
    if (!name) return;
    if (!projectByName.has(name)) projectByName.set(name, []);
    projectByName.get(name).push(id);
  });

  const taskProjectIdByTaskId = new Map();
  (tasks || []).forEach((t) => {
    const tid = t._id?.toString?.() || String(t._id);
    const pid = t.projectId?._id?.toString?.() || t.projectId?.toString?.() || t.projectId;
    if (tid && pid) taskProjectIdByTaskId.set(tid, String(pid));
  });

  return { projectById, projectByName, taskProjectIdByTaskId };
}

/** One canonical project per log — task.projectId wins over free-text project name. */
function resolveLogProjectId(log, ctx) {
  if (!ctx) return null;
  const { projectById, projectByName, taskProjectIdByTaskId } = ctx;

  const detailPid = log.details?.projectId?.toString?.() || log.details?.projectId;
  if (detailPid && projectById.has(String(detailPid))) return String(detailPid);

  if (log.targetType === 'Task') {
    const tid = log.targetId?.toString?.() || log.targetId;
    const fromTask = taskProjectIdByTaskId.get(String(tid));
    if (fromTask) return fromTask;
  }

  if (log.targetType === 'Project') {
    const pid = log.targetId?.toString?.() || log.targetId;
    if (pid && projectById.has(String(pid))) return String(pid);
  }

  const pname = (log.details?.project || log.payload?.project || '').trim();
  if (pname && projectByName.has(pname)) {
    const ids = projectByName.get(pname);
    if (ids.length === 1) return ids[0];
  }

  return null;
}

function logMatchesProject(log, project, ctx) {
  const pid = project._id?.toString?.() || String(project._id);
  return resolveLogProjectId(log, ctx) === pid;
}

function partitionLogsByProject(logs, projects, ctx) {
  const byProject = new Map();
  (projects || []).forEach((p) => {
    byProject.set(p._id?.toString?.() || String(p._id), []);
  });
  (logs || []).forEach((log) => {
    const pid = resolveLogProjectId(log, ctx);
    if (!pid || !byProject.has(pid)) return;
    byProject.get(pid).push(log);
  });
  return byProject;
}

function dedupeDailyLogs(logs, getDateKey) {
  const kept = new Map();
  let collapsed = 0;
  const sorted = [...logs].sort(
    (a, b) => new Date(b.createdAt || b.timestamp) - new Date(a.createdAt || a.timestamp),
  );
  for (const log of sorted) {
    const day = getDateKey(log.createdAt || log.timestamp);
    const type = logDetailType(log) || 'MANUAL';
    const userId = resolveLogUserId(log) || 'unknown';
    const taskId = log.targetType === 'Task' ? (log.targetId?.toString?.() || '') : '';
    let key;
    if (taskId && TASK_LOG_TYPES.has(type)) {
      key = `task|${userId}|${taskId}|${type}|${day}`;
    } else {
      key = `id|${log._id?.toString?.() || log._id}`;
    }
    if (kept.has(key)) {
      collapsed += 1;
      continue;
    }
    kept.set(key, log);
  }
  return { logs: [...kept.values()], collapsed };
}

function taskActiveInRange(task, rangeStart, rangeEnd) {
  const refs = [task.completedAt, task.updatedAt, task.dueDate, task.scheduleDate, task.createdAt].filter(Boolean);
  return refs.some((ref) => {
    const d = new Date(ref);
    return d >= rangeStart && d <= rangeEnd;
  });
}

function taskCompletedInRange(task, rangeStart, rangeEnd) {
  if (task.status !== 'done') return false;
  const ref = task.completedAt || task.updatedAt;
  if (!ref) return false;
  const d = new Date(ref);
  return d >= rangeStart && d <= rangeEnd;
}

function aggregateProjectEffort(opts) {
  const {
    logs,
    window,
    getDateKey,
    inRollingWindow,
    tasks = [],
    assigneesByTask = new Map(),
    projectMemberIds = new Set(),
    memberProfileById = new Map(),
    rangeStart,
    rangeEnd,
  } = opts;

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
        flags: [],
      });
    }
    return memberMap.get(uid);
  };

  const addTaskPriorityForAssignees = (task) => {
    const assignees = assigneesByTask.get(task._id?.toString?.() || String(task._id)) || [];
    const priority = task.priority || 'medium';
    assignees.forEach((uid) => {
      const member = ensureMember(uid);
      if (!member) return;
      if (member.tasksByPriority[priority] !== undefined) member.tasksByPriority[priority] += 1;
      else member.tasksByPriority.medium += 1;
    });
  };

  let manualLogHours = 0;
  let taskCompletionHours = 0;
  const completionsByUser = new Map();

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

    if (isTaskLog && logDetailType(log) === 'TASK_COMPLETION' && uid) {
      const taskId = log.targetId?.toString?.() || '';
      if (taskId) {
        const set = completionsByUser.get(uid) || new Set();
        set.add(taskId);
        completionsByUser.set(uid, set);
      }
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
    const tid = task._id?.toString?.() || String(task._id);
    const assignees = assigneesByTask.get(tid) || [];
    assignees.forEach((uid) => {
      const member = ensureMember(uid);
      if (member) member.tasksCompleted += 1;
    });
  });

  completionsByUser.forEach((taskIds, uid) => {
    const member = ensureMember(uid);
    if (!member) return;
    if (member.tasksCompleted < taskIds.size) member.tasksCompleted = taskIds.size;
  });

  const plannedHours = roundHours(tasksInRange.reduce((s, t) => s + (t.plannedHours || 0), 0));
  const totalHours = roundHours(manualLogHours + taskCompletionHours);

  const byMember = [...memberMap.values()]
    .filter((m) => projectMemberIds.has(m.userId) && (m.hours > 0 || m.logCount > 0 || m.tasksCompleted > 0))
    .map((m) => {
      const flags = [];
      if (m.taskHours > 0 && m.tasksCompleted === 0) flags.push('hours_without_completions');
      return { ...m, flags };
    })
    .sort((a, b) => b.hours - a.hours);

  return {
    summary: {
      totalHours,
      manualLogHours: roundHours(manualLogHours),
      taskCompletionHours: roundHours(taskCompletionHours),
      plannedHours,
      plannedVarianceHours: roundHours(totalHours - plannedHours),
      logEntries: logs.length,
      tasksCompleted: completedInRange.length,
      tasksTotal: tasksInRange.length,
      tasksInProgress: byStatus.inProgress + byStatus.inReview,
    },
    byDay: [...byDayMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    byMember,
    byStatus,
    byPriority,
    hoursMix: [
      { name: 'Manual logs', value: roundHours(manualLogHours) },
      { name: 'Task completion', value: roundHours(taskCompletionHours) },
    ].filter((d) => d.value > 0),
    dataQuality: {
      hoursWithoutCompletions: byMember.filter((m) => m.flags.includes('hours_without_completions')).length,
    },
  };
}

function buildEffortSummaryRow(effort) {
  return {
    totalHours: effort.summary.totalHours,
    manualLogHours: effort.summary.manualLogHours,
    taskCompletionHours: effort.summary.taskCompletionHours,
    logCount: effort.summary.logEntries,
    tasksCompleted: effort.summary.tasksCompleted,
    plannedHours: effort.summary.plannedHours,
    plannedVarianceHours: effort.summary.plannedVarianceHours,
  };
}

module.exports = {
  TASK_LOG_TYPES,
  resolveLogUserId,
  logDetailType,
  isTaskCompletionLog,
  logHours,
  buildAnalyticsContext,
  resolveLogProjectId,
  logMatchesProject,
  partitionLogsByProject,
  dedupeDailyLogs,
  taskActiveInRange,
  taskCompletedInRange,
  aggregateProjectEffort,
  buildEffortSummaryRow,
};
