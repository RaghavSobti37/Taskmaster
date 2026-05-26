const Task = require('../models/Task');
const Lead = require('../models/Lead');
const Log = require('../models/Log');
const Project = require('../models/Project');
const Campaign = require('../models/Campaign');
const MailCampaign = require('../models/MailCampaign');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

exports.getDashboardSummary = async (req, res) => {
  try {
    const userId = req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [taskStats, leadStats, logStats, projectStats, calendarRes, coreCamps, mailCamps] = await Promise.all([
      // 1. Task Statistics
      Task.aggregate([
        { $match: { createdBy: userId } },
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
        { $match: req.user.role === 'admin' ? {} : { assignedRepId: userId } },
        { $group: {
          _id: null,
          total: { $sum: 1 },
          converted: { $sum: { $cond: [{ $eq: ['$leadStatus', 'Converted'] }, 1, 0] } },
          highQuality: { $sum: { $cond: [{ $gte: ['$leadQuality', 4] }, 1, 0] } }
        }}
      ]),

      // 3. Log Statistics (Focus Hours)
      Log.aggregate([
        { $match: { userId: userId, action: 'DAILY_LOG', createdAt: { $gte: today } } },
        { $project: {
          timeValue: {
            $convert: {
              input: { $arrayElemAt: [{ $split: ['$details.timeSpent', 'h'] }, 0] },
              to: 'double',
              onError: 1.0,
              onNull: 1.0
            }
          }
        }},
        { $group: {
          _id: null,
          focusHours: { $sum: '$timeValue' }
        }}
      ]),

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
        date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
      }).lean(),

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

    res.json({
      metrics: {
        completionRate,
        criticalTasks: tasks.critical,
        overdueTasks: tasks.overdue,
        focusHours: logs.focusHours,
        totalLeads: leads.total,
        conversionRate,
        highQualityLeads: leads.highQuality,
        projectCount: projects.count,
        bouncedEmails
      },
      calendar,
      velocity: completionRate > 75 ? 'Optimal' : completionRate > 50 ? 'Stable' : 'Critical'
    });
  } catch (error) {
    logger.error('dashboardController', 'Dashboard Summary ', { error: error.message || error });
    res.status(500).json({ error: 'System error during operational aggregation.' });
  }
};
