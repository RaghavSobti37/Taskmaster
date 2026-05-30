const cron = require('node-cron');
const Lead = require('../models/Lead');
const Task = require('../models/Task');
const TaskAssignment = require('../models/TaskAssignment');
const { parse, addMinutes, addHours, isBefore, isAfter } = require('date-fns');
const logger = require('../utils/logger');
const { MODULE } = require('../../shared/systemLogContract');
const { createNotification } = require('./notificationDispatcher');
const { buildTaskActionUrl, buildLeadActionUrl } = require('../utils/notificationActionUrl');

const checkFollowups = async () => {
  try {
    const now = new Date();
    const tenMinsFromNow = addMinutes(now, 10);

    const leads = await Lead.find({
      nextFollowupDate: { $exists: true, $ne: '' },
      nextFollowupTime: { $exists: true, $ne: '' },
      reminderSent: false
    }).populate('assignedRepId');

    for (const lead of leads) {
      try {
        const followupStr = `${lead.nextFollowupDate} ${lead.nextFollowupTime}`;
        const followupDate = parse(followupStr, 'dd-MM-yyyy HH:mm', new Date());
        if (isNaN(followupDate.getTime())) continue;

        if (isBefore(followupDate, tenMinsFromNow) && isAfter(followupDate, now)) {
          const rep = lead.assignedRepId;
          if (!rep) continue;

          await createNotification({
            recipientId: rep._id,
            title: 'Upcoming Call',
            message: `Reminder: call ${lead.name} at ${lead.nextFollowupTime}. Click to view pitch notes.`,
            category: 'crm',
            type: 'reminder',
            relatedLeadId: lead._id,
            actionUrl: buildLeadActionUrl(lead._id)
          });

          lead.reminderSent = true;
          await lead.save();
        }
      } catch (err) {
        logger.error('Reminder', `Error processing reminder for lead ${lead._id}`, { error: err.message });
      }
    }
  } catch (err) {
    logger.error('Reminder', 'Error in checkFollowups', { error: err.message, persist: true, module: MODULE.SYSTEM });
  }
};

const checkTaskWarnings = async () => {
  try {
    const now = new Date();
    const in24h = addHours(now, 24);

    const tasks = await Task.find({
      status: { $nin: ['done', 'in-review'] },
      dueDate: { $lte: in24h, $gt: now },
      notifiedWarning: false
    }).lean();

    for (const task of tasks) {
      const assignments = await TaskAssignment.find({ taskId: task._id }).lean();
      for (const a of assignments) {
        await createNotification({
          recipientId: a.userId,
          title: 'Task Due in 24 Hours',
          message: `Task "${task.title}" is due within 24 hours.`,
          category: 'task',
          type: 'alert',
          relatedTaskId: task._id,
          relatedProjectId: task.projectId,
          actionUrl: task.projectId ? buildTaskActionUrl(task) : '/todo',
          iconType: 'task'
        });
      }
      await Task.findByIdAndUpdate(task._id, { notifiedWarning: true });
    }
  } catch (err) {
    logger.error('Warning', 'Error in checkTaskWarnings', { error: err.message });
  }
};

const checkOverdue = async () => {
  try {
    const now = new Date();

    const overdueTasks = await Task.find({
      status: { $ne: 'done' },
      dueDate: { $lt: now },
      notifiedOverdue: false
    }).lean();

    for (const task of overdueTasks) {
      const assignments = await TaskAssignment.find({ taskId: task._id }).lean();
      for (const a of assignments) {
        await createNotification({
          recipientId: a.userId,
          title: 'Overdue Task Alert',
          message: `Task "${task.title}" is overdue. Please resolve it as soon as possible.`,
          category: 'task',
          type: 'alert',
          relatedTaskId: task._id,
          relatedProjectId: task.projectId,
          actionUrl: task.projectId ? buildTaskActionUrl(task) : '/todo',
          iconType: 'task'
        });
      }
      await Task.findByIdAndUpdate(task._id, { notifiedOverdue: true });
    }

    const overdueLeads = await Lead.find({
      leadStatus: { $ne: 'Converted' },
      nextFollowupDate: { $exists: true, $ne: '' },
      notifiedOverdue: false
    }).populate('assignedRepId');

    for (const lead of overdueLeads) {
      try {
        const followupDate = new Date(lead.nextFollowupDate);
        if (isNaN(followupDate.getTime())) continue;

        if (followupDate < now) {
          const rep = lead.assignedRepId;
          if (!rep) continue;

          await createNotification({
            recipientId: rep._id,
            title: 'Overdue Follow-up',
            message: `Follow-up with ${lead.name} is overdue (scheduled ${lead.nextFollowupDate}).`,
            category: 'crm',
            type: 'alert',
            relatedLeadId: lead._id,
            actionUrl: buildLeadActionUrl(lead._id)
          });

          lead.notifiedOverdue = true;
          await lead.save();
        }
      } catch (err) {
        logger.error('Overdue', `Error processing overdue lead ${lead._id}`, { error: err.message });
      }
    }
  } catch (err) {
    logger.error('Overdue', 'Error in checkOverdue', { error: err.message, persist: true, module: MODULE.SYSTEM });
  }
};

const init = () => {
  logger.info('System', 'Initializing Reminder Service...');
  cron.schedule('* * * * *', () => {
    checkFollowups();
    checkTaskWarnings();
    checkOverdue();
  });
};

module.exports = { init, checkOverdue, checkTaskWarnings, checkFollowups };
