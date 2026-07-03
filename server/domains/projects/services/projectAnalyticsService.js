const Project = require('../models/Project');
const Log = require('../../../models/Log');
const User = require('../../../models/User');
const FinanceDocument = require('../../../models/FinanceDocument');
const {
  rollupFinanceByProject,
  SPEND_TRACK_CATEGORIES,
  mapFinanceDocForAnalytics,
} = require('../../../../shared/projectFinanceRollup');
const {
  buildAnalyticsContext,
  resolveLogProjectId,
  logMatchesProject,
  partitionLogsByProject,
  dedupeDailyLogs,
  aggregateProjectEffort,
  buildEffortSummaryRow,
  resolveLogUserId,
} = require('../../../../shared/projectAnalyticsCore.cjs');
const taskProjectQueryService = require('../../tasks/services/taskProjectQueryService');
const { resolveRollingRange, inRollingWindow } = require('../../../../shared/reportRange');
const { getDateKey, startOfDayFromKey, endOfDayFromKey } = require('../../../utils/attendanceDate');
const { canAccessProject, getAccessibleProjectsFilter } = require('../../../utils/projectAccess');
const { ACTIVE_LOG_FILTER } = require('../../../utils/taskDailyLogs');

const DEFAULT_LABOR_RATE_INR = Number(process.env.PROJECT_ANALYTICS_LABOR_RATE_INR) || 0;

const emptyFinance = () => ({
  hasBudget: false,
  budget: null,
  spentTotal: 0,
  spentInRange: 0,
  spentInRangeBase: 0,
  revenueTotal: 0,
  revenueInRange: 0,
  revenueInRangeBase: 0,
  remaining: null,
  budgetUsedPct: null,
  spendByCategory: {},
  excludedDocCount: 0,
  unverifiedDocCount: 0,
  foreignSpendInRange: [],
  spentInRangeByCurrency: {},
});

const buildProjectLogFilter = (project, rangeStart, rangeEnd, taskIds = []) => {
  const pid = project._id;
  const pidStr = pid?.toString?.() || String(pid);
  const orClauses = [
    { targetId: pid, targetType: 'Project' },
    { 'details.projectId': pid },
    { 'details.projectId': pidStr },
    { 'details.project': project.name },
  ];
  if (taskIds.length) {
    orClauses.push({ targetId: { $in: taskIds }, targetType: 'Task' });
  }
  return {
    ...ACTIVE_LOG_FILTER,
    action: 'DAILY_LOG',
    createdAt: { $gte: rangeStart, $lte: rangeEnd },
    $or: orClauses,
  };
};

const buildBulkDailyLogFilter = (projects, projectIds, taskIds, rangeStart, rangeEnd) => {
  const idVariants = [];
  projectIds.forEach((id) => {
    idVariants.push(id);
    const s = id?.toString?.();
    if (s) idVariants.push(s);
  });
  const orClauses = [
    { targetId: { $in: projectIds }, targetType: 'Project' },
    { 'details.projectId': { $in: idVariants } },
    { 'details.project': { $in: projects.map((p) => p.name).filter(Boolean) } },
  ];
  if (taskIds.length) {
    orClauses.push({ targetId: { $in: taskIds }, targetType: 'Task' });
  }
  return {
    ...ACTIVE_LOG_FILTER,
    action: 'DAILY_LOG',
    createdAt: { $gte: rangeStart, $lte: rangeEnd },
    $or: orClauses,
  };
};

const filterLogsForProject = (logs, project, ctx) => {
  const pid = project._id?.toString?.() || String(project._id);
  return logs.filter((log) => resolveLogProjectId(log, ctx) === pid);
};

const formatLogEntry = (log, profile, duplicateCollapsed) => {
  const created = log.createdAt || log.timestamp;
  const d = new Date(created);
  const pad = (n) => String(n).padStart(2, '0');
  const name = typeof profile === 'string' ? profile : (profile?.name || '');
  const avatar = typeof profile === 'object' && profile ? (profile.avatar || '') : '';
  return {
    _id: log._id,
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
    duplicateCollapsed,
  };
};

const buildAssigneesMap = (projectAssignments) => {
  const assigneesByTask = new Map();
  projectAssignments.forEach((a) => {
    const tid = a.taskId?.toString();
    const uid = a.userId?.toString();
    if (!tid || !uid) return;
    if (!assigneesByTask.has(tid)) assigneesByTask.set(tid, []);
    assigneesByTask.get(tid).push(uid);
  });
  return assigneesByTask;
};

const enrichMemberProfiles = async (memberProfileById, extraUserIds) => {
  const missingProfileIds = [...extraUserIds].filter((id) => !memberProfileById.has(id));
  if (!missingProfileIds.length) return;
  const extraUsers = await User.find({ _id: { $in: missingProfileIds } }).select('name avatar').lean();
  extraUsers.forEach((u) => {
    memberProfileById.set(u._id.toString(), { name: u.name, avatar: u.avatar || '' });
  });
};

const computeLaborCost = (totalHours) => {
  if (!DEFAULT_LABOR_RATE_INR || totalHours <= 0) {
    return { laborRateInr: DEFAULT_LABOR_RATE_INR || null, laborCostInr: null };
  }
  return {
    laborRateInr: DEFAULT_LABOR_RATE_INR,
    laborCostInr: Math.round(totalHours * DEFAULT_LABOR_RATE_INR),
  };
};

const buildDataQuality = (effort, finance, dedupeCollapsed) => ({
  duplicateLogsCollapsed: dedupeCollapsed,
  excludedFinanceDocs: finance.excludedDocCount || 0,
  unverifiedFinanceDocs: finance.unverifiedDocCount || 0,
  membersHoursWithoutCompletions: effort.dataQuality?.hoursWithoutCompletions || 0,
});

const assembleProjectReport = ({
  project,
  window,
  effort,
  finance,
  financeDocs,
  rangeStart,
  rangeEnd,
  dedupeCollapsed,
  tasks,
  assigneesByTask,
  memberProfileById,
  recentLogs,
  mode = 'full',
}) => {
  const labor = computeLaborCost(effort.summary.totalHours);
  const estimatedTotalCostInr = labor.laborCostInr != null
    ? labor.laborCostInr + (finance.spentInRangeBase || 0)
    : null;

  const summary = {
    ...effort.summary,
    hasBudget: finance.hasBudget,
    budget: finance.budget,
    spentTotal: finance.spentTotal,
    spentInRange: finance.spentInRangeBase ?? finance.spentInRange,
    spentInRangeRaw: finance.spentInRange,
    revenueTotal: finance.revenueTotal,
    revenueInRange: finance.revenueInRangeBase ?? finance.revenueInRange,
    remaining: finance.remaining,
    budgetUsedPct: finance.budgetUsedPct,
    laborRateInr: labor.laborRateInr,
    laborCostInr: labor.laborCostInr,
    estimatedTotalCostInr,
    foreignSpendInRange: finance.foreignSpendInRange || [],
  };

  if (mode === 'summary') {
    return {
      projectId: project._id,
      ...buildEffortSummaryRow(effort),
      hasBudget: finance.hasBudget,
      budget: finance.budget,
      spentTotal: finance.spentTotal,
      spentInRange: finance.spentInRangeBase ?? finance.spentInRange,
      revenueTotal: finance.revenueTotal,
      revenueInRange: finance.revenueInRangeBase ?? finance.revenueInRange,
      remaining: finance.remaining,
      budgetUsedPct: finance.budgetUsedPct,
      spendByCategory: finance.spendByCategory,
      foreignSpendInRange: finance.foreignSpendInRange || [],
    };
  }

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
    summary,
    dataQuality: buildDataQuality(effort, finance, dedupeCollapsed),
    finance: {
      spendByCategory: finance.spendByCategory,
      hasBudget: finance.hasBudget,
      spentInRangeBase: finance.spentInRangeBase,
      spentInRangeByCurrency: finance.spentInRangeByCurrency,
      foreignSpendInRange: finance.foreignSpendInRange,
      documents: financeDocs
        .filter((doc) => SPEND_TRACK_CATEGORIES.has(doc.category) && Number(doc.metadata?.amount) > 0)
        .map((doc) => mapFinanceDocForAnalytics(doc, rangeStart, rangeEnd))
        .sort((a, b) => new Date(b.date) - new Date(a.date)),
    },
    openTasks: tasks
      .filter((t) => t.status !== 'done')
      .map((task) => {
        const assigneeIds = assigneesByTask.get(task._id.toString()) || [];
        return {
          _id: task._id,
          title: task.title,
          status: task.status,
          priority: task.priority || 'medium',
          plannedHours: task.plannedHours || 0,
          dueDate: task.dueDate || null,
          assignees: assigneeIds.map((uid) => ({
            userId: uid,
            name: memberProfileById.get(uid)?.name || 'Unknown',
            avatar: memberProfileById.get(uid)?.avatar || '',
          })),
        };
      })
      .sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const pa = priorityOrder[a.priority] ?? 2;
        const pb = priorityOrder[b.priority] ?? 2;
        if (pa !== pb) return pa - pb;
        if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return a.title.localeCompare(b.title);
      }),
    byDay: effort.byDay,
    byMember: effort.byMember,
    byStatus: effort.byStatus,
    byPriority: effort.byPriority,
    hoursMix: effort.hoursMix,
    recentLogs: recentLogs || [],
  };
};

const processProjectAnalytics = async ({
  project,
  window,
  memberProfileById,
  logsForProject,
  tasks,
  projectAssignments,
  financeDocs,
  mode = 'full',
}) => {
  const rangeStart = startOfDayFromKey(window.startKey);
  const rangeEnd = endOfDayFromKey(window.endKey);

  const { logs: dedupedLogs, collapsed } = dedupeDailyLogs(logsForProject, getDateKey);
  const assigneesByTask = buildAssigneesMap(projectAssignments);
  const projectMemberIds = new Set((project.members || []).map((m) => m.toString()));

  const extraUserIds = new Set();
  projectAssignments.forEach((a) => {
    const uid = a.userId?.toString();
    if (uid) extraUserIds.add(uid);
  });
  dedupedLogs.forEach((log) => {
    const uid = resolveLogUserId(log);
    if (uid) extraUserIds.add(uid);
  });
  await enrichMemberProfiles(memberProfileById, extraUserIds);

  const effort = aggregateProjectEffort({
    logs: dedupedLogs,
    window,
    getDateKey,
    inRollingWindow,
    tasks,
    assigneesByTask,
    projectMemberIds,
    memberProfileById,
    rangeStart,
    rangeEnd,
  });

  let recentLogs = [];
  if (mode === 'full') {
    const keptIds = new Set(dedupedLogs.map((l) => l._id?.toString()));
    recentLogs = [...logsForProject]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 80)
      .map((log) => {
        const uid = resolveLogUserId(log);
        return formatLogEntry(
          log,
          memberProfileById.get(uid) || { name: '', avatar: '' },
          !keptIds.has(log._id?.toString()),
        );
      });
  }

  const financeByProjectId = rollupFinanceByProject(financeDocs, rangeStart, rangeEnd);
  const finance = financeByProjectId.get(project._id.toString()) || emptyFinance();

  return assembleProjectReport({
    project,
    window,
    effort,
    finance,
    financeDocs,
    rangeStart,
    rangeEnd,
    dedupeCollapsed: collapsed,
    tasks,
    assigneesByTask,
    memberProfileById,
    recentLogs,
    mode,
  });
};

const buildAnalyticsForProject = async (project, window, memberProfileById = new Map(), mode = 'full', analyticsCtx = null) => {
  const rangeStart = startOfDayFromKey(window.startKey);
  const rangeEnd = endOfDayFromKey(window.endKey);

  const tasks = await taskProjectQueryService.findTasksByProjectId(
    project._id,
    'title status priority actualHours plannedHours completedAt updatedAt dueDate scheduleDate createdAt projectId',
  );

  const taskIds = tasks.map((t) => t._id);
  const ctx = analyticsCtx || buildAnalyticsContext([project], tasks);

  const [rawLogs] = await Promise.all([
    Log.find(buildProjectLogFilter(project, rangeStart, rangeEnd, taskIds))
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const logs = filterLogsForProject(rawLogs, project, ctx);

  const projectAssignments = taskIds.length
    ? await taskProjectQueryService.findAssignmentsByTaskIds(taskIds)
    : [];

  const financeDocs = await FinanceDocument.find({
    project: project._id,
    isFolder: { $ne: true },
  })
    .select('title referenceNumber project category metadata createdAt approvalStatus fileName')
    .lean();

  return processProjectAnalytics({
    project,
    window,
    memberProfileById,
    logsForProject: logs,
    tasks,
    projectAssignments,
    financeDocs,
    mode,
  });
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
  return buildAnalyticsForProject(project, window, memberProfileById, 'full');
};

const buildProjectsAnalyticsSummary = async (user, rangeQuery = {}) => {
  const window = resolveRollingRange(rangeQuery);
  const rangeStart = startOfDayFromKey(window.startKey);
  const rangeEnd = endOfDayFromKey(window.endKey);

  const projects = await Project.find(getAccessibleProjectsFilter(user))
    .select('name owner members status progress workspace')
    .lean();

  if (!projects.length) {
    return { window: { start: window.startKey, end: window.endKey, days: window.days, timeframe: window.timeframe }, projects: [] };
  }

  const projectIds = projects.map((p) => p._id);

  const allTasks = await taskProjectQueryService.findTasksByProjectIds(
    projectIds,
    'projectId title status priority plannedHours completedAt updatedAt dueDate scheduleDate createdAt',
  );

  const allTaskIds = allTasks.map((t) => t._id);
  const analyticsCtx = buildAnalyticsContext(projects, allTasks);

  const [allLogs, allFinanceDocs] = await Promise.all([
    Log.find(buildBulkDailyLogFilter(projects, projectIds, allTaskIds, rangeStart, rangeEnd)).lean(),
    FinanceDocument.find({
      project: { $in: projectIds },
      isFolder: { $ne: true },
    })
      .select('title referenceNumber project category metadata createdAt approvalStatus fileName')
      .lean(),
  ]);

  const logsByProject = partitionLogsByProject(allLogs, projects, analyticsCtx);

  const tasksByProject = new Map();
  allTasks.forEach((t) => {
    const pid = t.projectId?.toString();
    if (!pid) return;
    if (!tasksByProject.has(pid)) tasksByProject.set(pid, []);
    tasksByProject.get(pid).push(t);
  });

  const financeByProject = new Map();
  allFinanceDocs.forEach((doc) => {
    const pid = doc.project?.toString();
    if (!pid) return;
    if (!financeByProject.has(pid)) financeByProject.set(pid, []);
    financeByProject.get(pid).push(doc);
  });

  const allAssignments = allTaskIds.length
    ? await taskProjectQueryService.findAssignmentsByTaskIds(allTaskIds)
    : [];
  const assignmentsByProject = new Map();
  allAssignments.forEach((a) => {
    const tid = a.taskId?.toString();
    const task = allTasks.find((t) => t._id.toString() === tid);
    const pid = task?.projectId?.toString();
    if (!pid) return;
    if (!assignmentsByProject.has(pid)) assignmentsByProject.set(pid, []);
    assignmentsByProject.get(pid).push(a);
  });

  const memberProfileById = await loadMemberProfiles(projects);

  const summaries = await Promise.all(projects.map((project) => {
    const pid = project._id.toString();
    const logsForProject = logsByProject.get(pid) || [];
    return processProjectAnalytics({
      project,
      window,
      memberProfileById,
      logsForProject,
      tasks: tasksByProject.get(pid) || [],
      projectAssignments: assignmentsByProject.get(pid) || [],
      financeDocs: financeByProject.get(pid) || [],
      mode: 'summary',
    });
  }));

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
  buildAnalyticsForProject,
  processProjectAnalytics,
  logMatchesProject,
  canAccessProject,
};
