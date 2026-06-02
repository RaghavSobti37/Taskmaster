const Task = require('../models/Task');
const TaskAssignment = require('../models/TaskAssignment');
const Lead = require('../models/Lead');
const Log = require('../models/Log');
const Project = require('../models/Project');
const Campaign = require('../models/Campaign');
const MailCampaign = require('../models/MailCampaign');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { isAdminUser } = require('../utils/departmentPermissions');
const { getCache, setCache } = require('../services/cacheService');
const { parseTimeSpentToHours } = require('../../shared/timeSpent');

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

const { todayStart, todayEnd, getDateKey, startOfDayFromKey } = require('../utils/attendanceDate');

const sumFocusHours = async (match) => {
  const logs = await Log.find(match).select('details.timeSpent').lean();
  const focusHours = logs.reduce(
    (sum, log) => sum + parseTimeSpentToHours(log.details?.timeSpent),
    0
  );
  const rounded = Math.round(focusHours * 100) / 100;
  const logCount = logs.length;
  const focusAvgHours =
    logCount > 0 ? Math.round((rounded / logCount) * 10) / 10 : 0;
  return [{ focusHours: rounded, logCount, focusAvgHours }];
};

const aggregateTaskStats = (periodMatch) => Task.aggregate([
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

const aggregateLeadStats = (periodMatch) => Lead.aggregate([
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
    const cacheKey = `dashboard:dept-stats:v3:${timeframe}:${getDateKey()}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

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

    await setCache(cacheKey, payload, 60);
    res.json(payload);
  } catch (error) {
    logger.error('dashboardController', 'Department Stats', { error: error.message || error });
    res.status(500).json({ error: 'Failed to load department stats' });
  }
};

exports.getDashboardSummary = async (req, res) => {
  try {
    const userId = req.user._id;
    const cacheKey = `dashboard:summary:v2:${userId}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const today = todayStart();
    const todayEndTime = todayEnd();

    const assignments = await TaskAssignment.find({ userId }).select('taskId').lean();
    const assignedTaskIds = assignments.map(a => a.taskId);

    const [taskStats, leadStats, logStats, projectStats, calendarRes, coreCamps, mailCamps] = await Promise.all([
      // 1. Task Statistics (assigned tasks only)
      Task.aggregate([
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
      Lead.aggregate([
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
      Project.aggregate([
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

      // 6. Campaign Data for Bounces
      Campaign.find({ createdBy: userId }, 'recipients').lean(),
      MailCampaign.find({ createdBy: userId }, 'recipients').lean()
    ]);

    let bouncedEmails = 0;
    for (const c of [...(coreCamps || []), ...(mailCamps || [])]) {
      (c.recipients || []).forEach(r => {
        if (['Bounced', 'Failed', 'Invalid'].includes(r.status)) bouncedEmails++;
      });
    }

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
    res.json(payload);
  } catch (error) {
    logger.error('dashboardController', 'Dashboard Summary ', { error: error.message || error });
    res.status(500).json({ error: 'System error during operational aggregation.' });
  }
};
