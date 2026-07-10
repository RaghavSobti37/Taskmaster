const Task = require('../models/Task');
const { getCompletedTasksCutoff } = require('../../../utils/taskListFilter');
const { purgeActivityForTasks } = require('./TaskActivityService');
const logger = require('../../../utils/logger');

/**
 * Remove task conversation/history for completed tasks that no longer appear
 * in default task lists (same 2-day cutoff as taskListFilter).
 */
const purgeStaleTaskActivity = async () => {
  const cutoff = getCompletedTasksCutoff();

  const staleTasks = await Task.find({
    status: 'done',
    $or: [
      { completedAt: { $lt: cutoff } },
      {
        $and: [
          { $or: [{ completedAt: null }, { completedAt: { $exists: false } }] },
          { updatedAt: { $lt: cutoff } },
        ],
      },
    ],
  })
    .select('_id')
    .lean();

  const taskIds = staleTasks.map((t) => t._id);
  if (!taskIds.length) {
    return { taskCount: 0, activities: 0, receipts: 0 };
  }

  const result = await purgeActivityForTasks(taskIds);
  logger.info('taskActivityPurge', 'Purged stale task activity', {
    taskCount: taskIds.length,
    ...result,
  });

  return { taskCount: taskIds.length, ...result };
};

module.exports = { purgeStaleTaskActivity };
