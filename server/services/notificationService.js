const cron = require('node-cron');
const Lead = require('../models/Lead');
const Task = require('../models/Task');
const TaskAssignment = require('../models/TaskAssignment');
const { parse, addMinutes, addHours, isBefore, isAfter } = require('date-fns');
const logger = require('../utils/logger');
const { MODULE } = require('../../shared/systemLogContract');
const { createNotification } = require('./notificationDispatcher');
const { buildTaskActionUrl, buildLeadActionUrl } = require('../utils/notificationActionUrl');
const { getISTDate } = require('../utils/attendanceDate');
const redis = require('../utils/sharedRedis');

// Redis lock helpers
const acquireLock = async (lockKey, ttlSeconds = 90) => {
  try {
    const result = await redis.set(lockKey, 'locked', 'PX', ttlSeconds * 1000, 'NX');
    return result === 'OK';
  } catch (err) {
    logger.warn('Lock', `Failed to acquire lock ${lockKey}`, { error: err.message });
    return false;
  }
};

const releaseLock = async (lockKey) => {
  try {
    await redis.del(lockKey);
  } catch (err) {
    logger.warn('Lock', `Failed to release lock ${lockKey}`, { error: err.message });
  }
};

const checkFollowups = async () => {
  const lockKey = 'notification-lock:followups';
  const hasLock = await acquireLock(lockKey, 60);
  if (!hasLock) {
    logger.debug('Lock', 'Skipping checkFollowups (lock exists)');
    return;
  }

  try {
    const now = getISTDate();
    const thirtyMinsFromNow = addMinutes(now, 30);
    const thirtyMinsBefore = addMinutes(now, -30);

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

        if (isBefore(followupDate, thirtyMinsFromNow) && isAfter(followupDate, thirtyMinsBefore)) {
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
  } finally {
    await releaseLock(lockKey);
  }
};


const checkOverdue = async () => {
  const lockKey = 'notification-lock:overdue';
  const hasLock = await acquireLock(lockKey, 60);
  if (!hasLock) {
    logger.debug('Lock', 'Skipping checkOverdue (lock exists)');
    return;
  }

  try {
    const now = getISTDate();

    const session = await Task.startSession();
    session.startTransaction();

    try {
      const overdueTasks = await Task.find({
        status: { $ne: 'done' },
        dueDate: { $lt: now },
        notifiedOverdue: false
      }).lean().session(session);

      for (const task of overdueTasks) {
        const assignments = await TaskAssignment.find({ taskId: task._id }).lean().session(session);
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
        await Task.findByIdAndUpdate(task._id, { notifiedOverdue: true }, { session });
      }

      const overdueLeads = await Lead.find({
        leadStatus: { $ne: 'Converted' },
        nextFollowupDate: { $exists: true, $ne: '' },
        notifiedOverdue: false
      }).populate('assignedRepId').session(session);

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
            await lead.save({ session });
          }
        } catch (err) {
          logger.error('Overdue', `Error processing overdue lead ${lead._id}`, { error: err.message });
        }
      }

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } catch (err) {
    logger.error('Overdue', 'Error in checkOverdue', { error: err.message, persist: true, module: MODULE.SYSTEM });
  } finally {
    await releaseLock(lockKey);
  }
};

const init = () => {
  logger.info('System', 'Initializing Reminder Service...');
  cron.schedule('* * * * *', () => {
    checkFollowups();
    checkOverdue();
  });
};

module.exports = { init, checkOverdue, checkFollowups };
