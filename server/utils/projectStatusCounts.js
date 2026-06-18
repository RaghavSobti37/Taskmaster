const { startOfDay } = require('date-fns');
const Task = require('../models/Task');
const TaskAssignment = require('../models/TaskAssignment');

/** Same visibility as client filterTasksForUser (creator or assignee only). */
async function buildUserTaskScope(userId) {
  const assignments = await TaskAssignment.find({ userId }).select('taskId').lean();
  const taskIds = assignments.map((a) => a.taskId);
  return {
    $or: [
      { createdBy: userId },
      ...(taskIds.length ? [{ _id: { $in: taskIds } }] : []),
    ],
  };
}

/** Matches ProjectsView: filterOverdueTasks + countTasksByProject (projectId required). */
async function countProjectOverdueTasks(user) {
  const todayStart = startOfDay(new Date());
  const userScope = await buildUserTaskScope(user._id);

  return Task.countDocuments({
    ...userScope,
    projectId: { $exists: true, $ne: null },
    status: { $nin: ['done', 'in-review'] },
    $expr: {
      $let: {
        vars: { taskDay: { $ifNull: ['$scheduleDate', '$dueDate'] } },
        in: {
          $and: [
            { $ne: ['$$taskDay', null] },
            { $lt: ['$$taskDay', todayStart] },
          ],
        },
      },
    },
  });
}

function countProjectReviewTasks(reviewQueue = []) {
  return reviewQueue.filter((task) => {
    const pid = task?.projectId?._id || task?.projectId;
    return pid != null && pid !== '';
  }).length;
}

module.exports = {
  buildUserTaskScope,
  countProjectOverdueTasks,
  countProjectReviewTasks,
};
