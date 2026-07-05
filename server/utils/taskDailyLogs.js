const Log = require('../models/Log');
const { getDateKey, startOfDayFromKey, endOfDayFromKey } = require('./attendanceDate');

const ACTIVE_LOG_FILTER = { $or: [{ voidedAt: null }, { voidedAt: { $exists: false } }] };

const taskLogTypes = ['TASK_COMPLETION', 'TASK_REVIEW'];

const findActiveTaskDailyLogOnDay = (userId, taskId, type, dayKey = getDateKey(new Date()), session) => {
  const rangeStart = startOfDayFromKey(dayKey);
  const rangeEnd = endOfDayFromKey(dayKey);
  let q = Log.findOne({
    userId,
    targetId: taskId,
    targetType: 'Task',
    action: 'DAILY_LOG',
    'details.type': type,
    createdAt: { $gte: rangeStart, $lte: rangeEnd },
    ...ACTIVE_LOG_FILTER,
  });
  if (session) q = q.session(session);
  return q;
};

const findActiveTaskDailyLog = (userId, taskId, type, session) => {
  let q = Log.findOne({
    userId,
    targetId: taskId,
    targetType: 'Task',
    action: 'DAILY_LOG',
    'details.type': type,
    ...ACTIVE_LOG_FILTER,
  });
  if (session) q = q.session(session);
  return q;
};

const voidTaskDailyLogsForTask = async ({
  taskId,
  userIds = [],
  types = taskLogTypes,
  reason = 'task_rollback',
  session = null,
}) => {
  const filter = {
    targetId: taskId,
    targetType: 'Task',
    action: 'DAILY_LOG',
    'details.type': { $in: types },
    ...ACTIVE_LOG_FILTER,
  };
  if (userIds.length) {
    filter.userId = { $in: userIds };
  }
  const update = {
    $set: {
      voidedAt: new Date(),
      voidReason: reason,
      'details.voidedAt': new Date(),
      'details.voidReason': reason,
    },
  };
  let q = Log.updateMany(filter, update);
  if (session) q = q.session(session);
  return q;
};

module.exports = {
  ACTIVE_LOG_FILTER,
  taskLogTypes,
  findActiveTaskDailyLog,
  findActiveTaskDailyLogOnDay,
  voidTaskDailyLogsForTask,
};
