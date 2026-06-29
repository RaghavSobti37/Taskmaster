const { startOfDay } = require('date-fns');
const Task = require('../models/Task');
const TaskAssignment = require('../models/TaskAssignment');
const { mergeTaskListFilter } = require('./taskListFilter');

const DASHBOARD_HORIZON_DAYS = 35;

/** Same visibility as GET /api/tasks?scope=todo (creator, assignee, mentions). */
async function buildUserTodoScope(userId) {
  const assignments = await TaskAssignment.find({ userId }).select('taskId').lean();
  const taskIds = assignments.map((a) => a.taskId);
  return {
    $or: [
      { createdBy: userId },
      ...(taskIds.length ? [{ _id: { $in: taskIds } }] : []),
      { mentionAccessIds: userId },
    ],
  };
}

/** @deprecated alias */
const buildUserTaskScope = buildUserTodoScope;

/** Todo overview + navbar task badges — matches todo list KPI base filter. */
async function buildUserTodoStatsFilter(userId) {
  const scope = await buildUserTodoScope(userId);
  return mergeTaskListFilter({ ...scope });
}

/**
 * Projects navbar overdue — matches ProjectsView:
 * useDashboardTasks scope + filterOverdueTasks (scheduleDate first) + projectId.
 */
async function countProjectOverdueTasks(user) {
  const baseFilter = await buildUserTodoStatsFilter(user._id);
  const todayStart = startOfDay(new Date());
  const futureLimit = new Date(todayStart.getTime() + DASHBOARD_HORIZON_DAYS * 24 * 60 * 60 * 1000);
  const taskDay = { $ifNull: ['$scheduleDate', '$dueDate'] };

  return Task.countDocuments({
    $and: [
      baseFilter,
      { projectId: { $exists: true, $ne: null } },
      { status: { $nin: ['done', 'in-review'] } },
      {
        $expr: {
          $and: [
            { $ne: [taskDay, null] },
            { $lt: [taskDay, futureLimit] },
            { $lt: [taskDay, todayStart] },
          ],
        },
      },
    ],
  });
}

function countProjectReviewTasks(reviewQueue = []) {
  return reviewQueue.filter((task) => {
    const pid = task?.projectId?._id || task?.projectId;
    return pid != null && pid !== '';
  }).length;
}

module.exports = {
  buildUserTodoScope,
  buildUserTaskScope,
  buildUserTodoStatsFilter,
  countProjectOverdueTasks,
  countProjectReviewTasks,
  DASHBOARD_HORIZON_DAYS,
};
