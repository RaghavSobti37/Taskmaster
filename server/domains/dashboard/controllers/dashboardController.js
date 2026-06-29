const Task = require('../../tasks/models/Task');
const TaskAssignment = require('../../tasks/models/TaskAssignment');
const Lead = require('../../../models/Lead');
const Log = require('../../../models/Log');
const Project = require('../../../models/Project');
const { countUserCampaignBounces } = require('../../mail/services/mailMetricsService');
const mongoose = require('mongoose');
const logger = require('../../../utils/logger');
const { isAdminUser, isOpsUser } = require('../../../utils/departmentPermissions');
const Attendance = require('../../../models/Attendance');
const { isAttendanceExcluded } = require('../../../utils/attendanceUsers');
const { getCache, setCache } = require('../../../services/cacheService');
const { aggregateWithTenant } = require('../../../repositories/aggregateWithTenant');
const { getTenantId } = require('../../../utils/tenantContext');

const PRIVATE_CACHE_60 = 'private, max-age=60';
const DASHBOARD_STATS_TTL_SECONDS = 300;

const TIMEFRAME_DAYS = { '1d': 1, '7d': 7, '30d': 30 };

const rangeForTimeframe = (timeframe) => {
  const days = TIMEFRAME_DAYS[timeframe] || 7;
  const end = todayEnd();
  const todayKey = getDateKey();
  const anchor = new Date(`${todayKey}T12:00:00+05:30`);
  anchor.setDate(anchor.getDate() - (days - 1));
  const start = startOfDayFromKey(getDateKey(anchor));
  return { start, end, days };
};

const { todayStart, todayEnd, getDateKey, startOfDayFromKey, getTzOffset } = require('../../../utils/attendanceDate');

const applyAttendanceBuckets = (sets, row) => {
  const uid = String(row.userId);
  const hasCheck = Boolean(
    row.inTimeRecord?.manualTimestamp || row.outTimeRecord?.manualTimestamp
  );

  if (row.onLeave && !hasCheck) {
    sets.leave.add(uid);
    return;
  }
  if (row.isHalfDay) {
    sets.halfDay.add(uid);
    if (hasCheck) sets.marked.add(uid);
    return;
  }
  if (hasCheck) {
    sets.marked.add(uid);
    sets.present.add(uid);
  }
};

const enumerateDateKeysBetween = (start, end) => {
  const keys = [];
  const cursor = new Date(start);
  const endMs = end.getTime();
  while (cursor.getTime() <= endMs) {
    const key = getDateKey(cursor);
    if (key) keys.push(key);
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
};

const { formatDisplayDateShort } = require('../../../../shared/dateDisplay');

const formatChartDayLabel = (dateKey) => {
  try {
    const d = new Date(`${dateKey}T12:00:00${getTzOffset()}`);
    return formatDisplayDateShort(d, { emptyLabel: dateKey?.slice(5) || dateKey });
  } catch {
    return dateKey?.slice(5) || dateKey;
  }
};

const sumFocusHours = async (match) => {
  const { parseTimeSpentToHours } = require('../../../../shared/timeSpent');
  const [result] = await Log.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        logCount: { $sum: 1 },
        timeSpentValues: { $push: { $ifNull: ['$details.timeSpent', ''] } },
      },
    },
  ]);

  const timeSpentValues = result?.timeSpentValues || [];
  const focusHours = timeSpentValues.reduce(
    (sum, raw) => sum + parseTimeSpentToHours(raw),
    0,
  );
  const rounded = Math.round(focusHours * 100) / 100;
  const logCount = result?.logCount || 0;
  const focusAvgHours =
    logCount > 0 ? Math.round((rounded / logCount) * 10) / 10 : 0;
  return [{ focusHours: rounded, logCount, focusAvgHours }];
};

const aggregateTaskStats = (periodMatch) => aggregateWithTenant(Task, [
  {
    $facet: {
      completed: [
        {
          $match: {
            status: 'done',
            $or: [
              { completedAt: periodMatch },
              { $and: [{ $or: [{ completedAt: null }, { completedAt: { $exists: false } }] }, { updatedAt: periodMatch }] },
            ],
          },
        },
        { $count: 'count' },
      ],
      active: [
        {
          $match: {
            $or: [
              { updatedAt: periodMatch },
              { dueDate: periodMatch },
              { scheduleDate: periodMatch },
            ],
          },
        },
        { $count: 'count' },
      ],
    },
  },
]);

const aggregateLeadStats = (periodMatch) => aggregateWithTenant(Lead, [
  {
    $facet: {
      newLeads: [
        { $match: { createdAt: periodMatch } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            converted: { $sum: { $cond: [{ $eq: ['$leadStatus', 'Converted'] }, 1, 0] } },
          },
        },
      ],
      conversions: [
        { $match: { leadStatus: 'Converted', updatedAt: periodMatch } },
        { $count: 'count' },
      ],
      touched: [
        { $match: { updatedAt: periodMatch } },
        { $count: 'count' },
      ],
    },
  },
]);

exports.getDepartmentStats = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const timeframe = TIMEFRAME_DAYS[req.query.timeframe] ? req.query.timeframe : '7d';
    const { start, end, days } = rangeForTimeframe(timeframe);
    const tenantId = getTenantId() || req.user?.tenantId || 'default';
    const cacheKey = `dashboard:stats:${tenantId}`;
    const cachedBundle = await getCache(cacheKey);
    if (cachedBundle?.[timeframe]) {
      res.set('Cache-Control', PRIVATE_CACHE_60);
      return res.json(cachedBundle[timeframe]);
    }

    const periodMatch = { $gte: start, $lte: end };

    const [taskFacet, leadFacet, logStats] = await Promise.all([
      aggregateTaskStats(periodMatch),
      aggregateLeadStats(periodMatch),
      sumFocusHours({ action: 'DAILY_LOG', createdAt: periodMatch }),
    ]);

    const taskResult = taskFacet[0] || {};
    const leadResult = leadFacet[0] || {};
    const logs = logStats[0] || { focusHours: 0 };

    const tasksCompleted = taskResult.completed?.[0]?.count || 0;
    const tasksActive = taskResult.active?.[0]?.count || 0;
    const newLeads = leadResult.newLeads?.[0] || { total: 0, converted: 0 };
    const conversionsInPeriod = leadResult.conversions?.[0]?.count || 0;
    const leadsTouched = leadResult.touched?.[0]?.count || 0;

    const completionRate = tasksActive > 0
      ? Math.round((tasksCompleted / tasksActive) * 100)
      : 0;
    const focusAvgHours =
      days > 0 ? Math.round((logs.focusHours / days) * 10) / 10 : 0;

    const payload = {
      timeframe,
      range: { start: start.toISOString(), end: end.toISOString(), days },
      metrics: {
        completionRate,
        convertedLeads: conversionsInPeriod,
        focusHours: logs.focusHours,
        focusAvgHours,
        tasksCompleted,
        tasksActive,
        newLeads: newLeads.total,
        leadsTouched,
      },
    };

    await setCache(cacheKey, { ...(cachedBundle || {}), [timeframe]: payload }, DASHBOARD_STATS_TTL_SECONDS);
    res.set('Cache-Control', PRIVATE_CACHE_60);
    res.json(payload);
  } catch (error) {
    logger.error('dashboardController', 'Department Stats', { error: error.message || error });
    res.status(500).json({ error: 'Failed to load department stats' });
  }
};

exports.getDashboardSummary = async (req, res) => {
  try {
    const userId = req.user._id;
    const fieldsParam = String(req.query.fields || '').trim().toLowerCase();
    const calendarOnly = fieldsParam === 'calendar';

    const cacheKey = calendarOnly
      ? `dashboard:summary:calendar:v1:${userId}`
      : `dashboard:summary:v2:${userId}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      res.set('Cache-Control', PRIVATE_CACHE_60);
      return res.json(cached);
    }

    const today = todayStart();
    const todayEndTime = todayEnd();

    if (calendarOnly) {
      const calendar = await mongoose.model('CalendarEvent').find({
        $or: [
          { visibility: 'public' },
          { createdBy: userId },
        ],
        date: { $gte: today, $lte: todayEndTime },
      }).setOptions({ bypassTenant: true }).lean();

      const payload = { calendar: calendar || [] };
      await setCache(cacheKey, payload, 60);
      res.set('Cache-Control', PRIVATE_CACHE_60);
      return res.json(payload);
    }

    const assignments = await TaskAssignment.find({ userId }).select('taskId').lean();
    const assignedTaskIds = assignments.map(a => a.taskId);

    const [taskStats, leadStats, logStats, projectStats, calendarRes, campaignRecipients] = await Promise.all([
      // 1. Task Statistics (assigned tasks only)
      aggregateWithTenant(Task, [
        { $match: { _id: { $in: assignedTaskIds } } },
        { $group: {
          _id: null,
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
          critical: { $sum: { $cond: [{ $in: ['$priority', ['critical', 'high']] }, 1, 0] } },
          overdue: { $sum: { $cond: [{ $and: [{ $lt: ['$dueDate', new Date()] }, { $ne: ['$status', 'done'] }] }, 1, 0] } }
        }}
      ]),

      // 2. Lead Statistics
      aggregateWithTenant(Lead, [
        { $match: isAdminUser(req.user) ? {} : { assignedRepId: userId } },
        { $group: {
          _id: null,
          total: { $sum: 1 },
          converted: { $sum: { $cond: [{ $eq: ['$leadStatus', 'Converted'] }, 1, 0] } },
          highQuality: { $sum: { $cond: [{ $gte: ['$leadQuality', 4] }, 1, 0] } }
        }}
      ]),

      // 3. Log Statistics (Focus Hours)
      sumFocusHours({ userId, action: 'DAILY_LOG', createdAt: { $gte: today } }),

      // 4. Project Portfolio
      aggregateWithTenant(Project, [
        { $match: { $or: [{ owner: userId }, { members: userId }] } },
        { $group: {
          _id: null,
          count: { $sum: 1 }
        }}
      ]),

      // 5. Calendar Events (Today)
      mongoose.model('CalendarEvent').find({ 
        $or: [
          { visibility: 'public' },
          { createdBy: userId }
        ],
        date: { $gte: today, $lte: todayEndTime }
      }).setOptions({ bypassTenant: true }).lean(),

      // 6. Campaign bounce count
      countUserCampaignBounces(userId),
    ]);

    const bouncedEmails = campaignRecipients || 0;

    const tasks = taskStats[0] || { total: 0, completed: 0, critical: 0, overdue: 0 };
    const leads = leadStats[0] || { total: 0, converted: 0, highQuality: 0 };
    const logs = logStats[0] || { focusHours: 0 };
    const projects = projectStats[0] || { count: 0 };
    const calendar = calendarRes || [];

    const completionRate = tasks.total > 0 ? Math.round((tasks.completed / tasks.total) * 100) : 0;
    const conversionRate = leads.total > 0 ? Math.round((leads.converted / leads.total) * 100) : 0;

    const payload = {
      metrics: {
        completionRate,
        criticalTasks: tasks.critical,
        overdueTasks: tasks.overdue,
        focusHours: logs.focusHours,
        focusAvgHours: logs.focusAvgHours,
        totalLeads: leads.total,
        convertedLeads: leads.converted,
        conversionRate,
        highQualityLeads: leads.highQuality,
        projectCount: projects.count,
        bouncedEmails
      },
      calendar,
      velocity: completionRate > 75 ? 'Optimal' : completionRate > 50 ? 'Stable' : 'Critical'
    };

    await setCache(cacheKey, payload, 60);
    res.set('Cache-Control', PRIVATE_CACHE_60);
    res.json(payload);
  } catch (error) {
    logger.error('dashboardController', 'Dashboard Summary ', { error: error.message || error });
    res.status(500).json({ error: 'System error during operational aggregation.' });
  }
};

/** Daily team attendance counts for dashboard widget (ops/admin). */
exports.getAttendanceOverview = async (req, res) => {
  try {
    if (!isAdminUser(req.user) && !isOpsUser(req.user)) {
      return res.status(403).json({ error: 'Operations or admin access required' });
    }

    const timeframe = TIMEFRAME_DAYS[req.query.timeframe] ? req.query.timeframe : '7d';
    const { start, end } = rangeForTimeframe(timeframe);
    const cacheKey = `dashboard:attendance-overview:v1:${timeframe}:${getDateKey()}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      res.set('Cache-Control', PRIVATE_CACHE_60);
      return res.json(cached);
    }

    const dateKeys = enumerateDateKeysBetween(start, end);
    const buckets = new Map(
      dateKeys.map((key) => [
        key,
        {
          date: key,
          label: formatChartDayLabel(key),
          marked: 0,
          present: 0,
          halfDay: 0,
          leave: 0,
        },
      ])
    );

    const userSets = new Map(
      dateKeys.map((key) => [key, { marked: new Set(), present: new Set(), halfDay: new Set(), leave: new Set() }])
    );

    const rows = await Attendance.find({
      date: { $gte: start, $lte: end },
    })
      .select('userId date onLeave isHalfDay inTimeRecord outTimeRecord username')
      .lean();

    for (const row of rows) {
      if (isAttendanceExcluded({ _id: row.userId, name: row.username, email: '' })) continue;
      const dayKey = getDateKey(row.date);
      if (!dayKey || !userSets.has(dayKey)) continue;

      applyAttendanceBuckets(userSets.get(dayKey), row);
    }

    for (const [dayKey, sets] of userSets.entries()) {
      const bucket = buckets.get(dayKey);
      if (!bucket) continue;
      bucket.marked = sets.marked.size;
      bucket.present = sets.present.size;
      bucket.halfDay = sets.halfDay.size;
      bucket.leave = sets.leave.size;
    }

    const series = dateKeys.map((key) => buckets.get(key));
    const last = series[series.length - 1] || {};
    const payload = {
      timeframe,
      series,
      totals: {
        marked: last.marked || 0,
        present: last.present || 0,
        halfDay: last.halfDay || 0,
        leave: last.leave || 0,
      },
    };

    await setCache(cacheKey, payload, 60);
    res.set('Cache-Control', PRIVATE_CACHE_60);
    res.json(payload);
  } catch (error) {
    logger.error('dashboardController', 'getAttendanceOverview', { error: error.message });
    res.status(500).json({ error: 'Failed to load attendance overview' });
  }
};
