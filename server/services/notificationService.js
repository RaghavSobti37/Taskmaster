const cron = require('node-cron');
const Lead = require('../models/Lead');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const { parse, addMinutes, isBefore, isAfter } = require('date-fns');
const logger = require('../utils/logger');
const { MODULE } = require('../../shared/systemLogContract');
const { createNotification } = require('./notificationDispatcher');
const { buildLeadActionUrl } = require('../utils/notificationActionUrl');
const { getISTDate, getDateKey, todayStart, isWeekend } = require('../utils/attendanceDate');
const { isAttendanceExcluded } = require('../utils/attendanceUsers');
const { getSharedRedis } = require('../utils/sharedRedis');
const redis = getSharedRedis();

// Redis lock helpers
const acquireLock = async (lockKey, ttlSeconds = 90) => {
  try {
    if (!redis || typeof redis.set !== 'function' || redis.status !== 'ready') {
      return true; // Bypass lock when redis is unavailable to allow local execution
    }
    const result = await redis.set(lockKey, 'locked', 'PX', ttlSeconds * 1000, 'NX');
    return result === 'OK';
  } catch (err) {
    logger.warn('Lock', `Failed to acquire lock ${lockKey}`, { error: err.message });
    return false;
  }
};

const releaseLock = async (lockKey) => {
  try {
    if (!redis || typeof redis.del !== 'function' || redis.status !== 'ready') {
      return; // Skip when redis is unavailable
    }
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
        let followupDate = parse(followupStr, 'dd-MM-yyyy HH:mm', new Date());
        if (isNaN(followupDate.getTime())) {
          followupDate = parse(followupStr, 'dd-MM-yyyy h:mm a', new Date());
        }
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

const hasRecordedCheckOut = (entry) =>
  !!(entry?.outTimeRecord?.manualTimestamp || entry?.outTimeRecord?.systemTimestamp);

const sendAttendanceCheckoutReminders = async () => {
  const dateKey = getDateKey();
  const lockKey = `notification-lock:attendance-checkout:${dateKey}`;
  const hasLock = await acquireLock(lockKey, 120);
  if (!hasLock) {
    logger.debug('Lock', 'Skipping sendAttendanceCheckoutReminders (lock exists)');
    return;
  }

  try {
    if (isWeekend()) {
      logger.debug('Attendance', 'Skipping checkout reminders on weekend');
      return;
    }

    const today = todayStart();
    const [users, attendanceRows] = await Promise.all([
      User.find({}).populate('departmentId', 'slug').lean(),
      Attendance.find({ date: today }).lean(),
    ]);

    const attendanceByUserId = new Map(
      attendanceRows.map((row) => [String(row.userId), row])
    );

    let sent = 0;
    for (const user of users) {
      if (!user?._id || isAttendanceExcluded(user)) continue;

      const entry = attendanceByUserId.get(String(user._id));
      if (entry?.onLeave) continue;
      if (hasRecordedCheckOut(entry)) continue;

      await createNotification({
        recipientId: user._id,
        title: 'Mark your check-out',
        message: 'It is 6:30 PM — please mark your attendance check-out for today.',
        category: 'attendance',
        type: 'reminder',
        actionUrl: '/attendance',
        iconType: 'system',
        sendEmail: false,
      });
      sent += 1;
    }

    logger.info('Attendance', `Checkout reminders sent to ${sent} users`, { dateKey, sent });
  } catch (err) {
    logger.error('Attendance', 'Error in sendAttendanceCheckoutReminders', {
      error: err.message,
      persist: true,
      module: MODULE.SYSTEM,
    });
  } finally {
    await releaseLock(lockKey);
  }
};

const init = () => {
  logger.debug('System', 'Initializing Reminder Service...');
  cron.schedule('* * * * *', () => {
    checkFollowups();
  });
  cron.schedule('30 18 * * *', () => {
    sendAttendanceCheckoutReminders();
  }, { timezone: 'Asia/Kolkata' });
};

module.exports = { init, checkFollowups, sendAttendanceCheckoutReminders };
