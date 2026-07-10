const taskRepository = require('../repositories/taskRepository');
const TaskAssignment = require('../models/TaskAssignment');

async function aggregateTaskCountsByProjectIds(projectIds) {
  if (!projectIds?.length) return [];
  return taskRepository.aggregate([
    { $match: { projectId: { $in: projectIds } } },
    {
      $group: {
        _id: '$projectId',
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
      },
    },
  ]);
}

async function findTasksByProjectId(projectId, select) {
  let query = taskRepository.find({ projectId });
  if (select) query = query.select(select);
  return query.lean();
}

async function findTasksByProjectIds(projectIds, select) {
  if (!projectIds?.length) return [];
  let query = taskRepository.find({ projectId: { $in: projectIds } });
  if (select) query = query.select(select);
  return query.lean();
}

async function findAssignmentsByTaskIds(taskIds, extraFilter = {}) {
  if (!taskIds?.length) return [];
  return TaskAssignment.find({ taskId: { $in: taskIds }, ...extraFilter }).lean();
}

module.exports = {
  aggregateTaskCountsByProjectIds,
  findTasksByProjectId,
  findTasksByProjectIds,
  findAssignmentsByTaskIds,
};
