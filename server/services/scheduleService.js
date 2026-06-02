const User = require('../models/User');
const Task = require('../models/Task');
const TaskAssignment = require('../models/TaskAssignment');
const Project = require('../models/Project');
const { format, addDays, startOfDay, endOfDay, parseISO } = require('date-fns');
const { toDateKey } = require('../../shared/dateValidation');
const {
  taskOverlapsRange,
  dateKeysInRange,
  spanCoversDateKey,
  resolveTaskSpan,
} = require('../../shared/scheduleTaskDates');

const UNASSIGNED_DEPT = {
  _id: 'unassigned',
  name: 'Unassigned',
  slug: 'unassigned',
  color: '#6b7280',
  sortOrder: 999,
};

const parseDateRange = (start, end) => {
  const startDate = start ? startOfDay(parseISO(start)) : startOfDay(new Date());
  const endDate = end ? endOfDay(parseISO(end)) : endOfDay(addDays(new Date(), 1));
  return { startDate, endDate };
};

const buildTaskDatePrefilter = (startDate, endDate) => ({
  status: { $ne: 'done' },
  $or: [
    { scheduleDate: { $gte: startDate, $lte: endDate } },
    { startDate: { $lte: endDate }, dueDate: { $gte: startDate } },
    { startDate: { $gte: startDate, $lte: endDate } },
    { dueDate: { $gte: startDate, $lte: endDate } },
    { startDate: { $lte: endDate }, dueDate: null },
    { dueDate: { $gte: startDate }, startDate: null, scheduleDate: null },
  ],
});

const collectProjectMemberIds = (projects) => {
  const ids = new Set();
  for (const proj of projects) {
    if (proj.owner) ids.add(proj.owner.toString());
    for (const memberId of proj.members || []) ids.add(memberId.toString());
  }
  return ids;
};

const buildDepartmentsFromUsers = (users) => {
  const deptMap = new Map();
  for (const user of users) {
    const dept = user.departmentId || UNASSIGNED_DEPT;
    const deptKey = dept._id?.toString() || 'unassigned';
    if (!deptMap.has(deptKey)) deptMap.set(deptKey, { department: dept, users: [] });
    deptMap.get(deptKey).users.push({
      _id: user._id,
      name: user.name,
      avatar: user.avatar,
    });
  }
  return [...deptMap.values()].sort(
    (a, b) => (a.department.sortOrder ?? 999) - (b.department.sortOrder ?? 999)
  );
};

const initWorkload = (users, rangeStartKey, rangeEndKey) => {
  const workload = {};
  const dayKeys = dateKeysInRange(rangeStartKey, rangeEndKey);
  for (const user of users) {
    const uid = user._id.toString();
    workload[uid] = {};
    for (const key of dayKeys) {
      workload[uid][key] = { amCount: 0, pmCount: 0, fullCount: 0, totalTasks: 0, plannedHours: 0 };
    }
  }
  return workload;
};

const incrementWorkloadForTask = (workload, task, rangeStartKey, rangeEndKey) => {
  const span = resolveTaskSpan(task);
  if (!span) return;
  const slot = task.scheduleSlot || 'FULL';
  const dayKeys = dateKeysInRange(rangeStartKey, rangeEndKey);
  for (const a of task.assignments || []) {
    const uid = (a.userId?._id || a.userId)?.toString();
    if (!uid || !workload[uid]) continue;
    for (const dateKey of dayKeys) {
      if (!spanCoversDateKey(span, dateKey)) continue;
      workload[uid][dateKey].totalTasks += 1;
      if (slot === 'AM') workload[uid][dateKey].amCount += 1;
      else if (slot === 'PM') workload[uid][dateKey].pmCount += 1;
      else workload[uid][dateKey].fullCount += 1;
    }
  }
};

const totalTasksForUser = (uid, workload, rangeStartKey, rangeEndKey) => {
  let total = 0;
  for (const key of dateKeysInRange(rangeStartKey, rangeEndKey)) {
    total += workload[uid]?.[key]?.totalTasks || 0;
  }
  return total;
};

const sortDepartmentUsers = (departments, workload, rangeStartKey, rangeEndKey) => {
  for (const group of departments) {
    group.users.sort((a, b) => {
      const aTotal = totalTasksForUser(a._id.toString(), workload, rangeStartKey, rangeEndKey);
      const bTotal = totalTasksForUser(b._id.toString(), workload, rangeStartKey, rangeEndKey);
      if (bTotal !== aTotal) return bTotal - aTotal;
      return a.name.localeCompare(b.name);
    });
  }
  return departments;
};

async function getScheduleForUser({ userId, start, end, projectId, departmentId }) {
  const { startDate, endDate } = parseDateRange(start, end);
  const rangeStartKey = toDateKey(startDate) || format(startDate, 'yyyy-MM-dd');
  const rangeEndKey = toDateKey(endDate) || format(endDate, 'yyyy-MM-dd');

  let userProjects = [];
  if (projectId) {
    const project = await Project.findById(projectId).select('_id members owner').lean();
    if (!project) {
      const err = new Error('Project not found');
      err.statusCode = 404;
      throw err;
    }
    userProjects = [project];
  } else {
    userProjects = await Project.find({
      $or: [{ owner: userId }, { members: userId }],
    })
      .select('_id members owner')
      .lean();
  }

  const userProjectIds = userProjects.map((p) => p._id);
  const emptyResponse = {
    start: rangeStartKey,
    end: rangeEndKey,
    departments: [],
    tasks: [],
  };

  if (!projectId && userProjectIds.length === 0) {
    return emptyResponse;
  }

  const taskFilter = {
    ...(projectId ? { projectId } : { projectId: { $in: userProjectIds } }),
    ...buildTaskDatePrefilter(startDate, endDate),
  };

  const candidateTasks = await Task.find(taskFilter)
    .select('title status scheduleSlot scheduleDate startDate dueDate projectId workspace color')
    .populate('projectId', 'name workspace color')
    .lean();

  const scheduleTasks = candidateTasks.filter((task) =>
    taskOverlapsRange(task, rangeStartKey, rangeEndKey)
  );

  if (scheduleTasks.length === 0 && projectId) {
    const memberIds = collectProjectMemberIds(userProjects);
    if (memberIds.size === 0) return emptyResponse;

    const userFilter = { _id: { $in: [...memberIds] } };
    if (departmentId) userFilter.departmentId = departmentId;

    const users = await User.find(userFilter)
      .select('name avatar departmentId')
      .populate('departmentId', 'name slug color sortOrder')
      .sort('name')
      .lean();

    return { ...emptyResponse, departments: buildDepartmentsFromUsers(users) };
  }

  if (scheduleTasks.length === 0) {
    return emptyResponse;
  }

  const scheduleTaskIds = scheduleTasks.map((t) => t._id);
  const assignments = await TaskAssignment.find({ taskId: { $in: scheduleTaskIds } })
    .select('taskId userId assignedBy assignedAt')
    .lean();

  const assignmentMap = {};
  const assignedUserIds = new Set();
  for (const a of assignments) {
    const tid = a.taskId.toString();
    if (!assignmentMap[tid]) assignmentMap[tid] = [];
    assignmentMap[tid].push({
      userId: a.userId,
      assignedBy: a.assignedBy,
      assignedAt: a.assignedAt,
    });
    assignedUserIds.add(a.userId.toString());
  }

  const tasksWithAssignments = scheduleTasks.map((task) => {
    const assignments = assignmentMap[task._id.toString()] || [];
    return {
      ...task,
      assignments,
      assignees: assignments.map((a) => a.userId),
    };
  });

  const activeUserIds = new Set(assignedUserIds);
  for (const memberId of collectProjectMemberIds(userProjects)) {
    activeUserIds.add(memberId);
  }

  const userFilter = { _id: { $in: [...activeUserIds] } };
  if (departmentId) userFilter.departmentId = departmentId;

  let users = await User.find(userFilter)
    .select('name avatar departmentId')
    .populate('departmentId', 'name slug color sortOrder')
    .sort('name')
    .lean();

  if (projectId) {
    const memberIds = collectProjectMemberIds(userProjects);
    users = users.filter((u) => memberIds.has(u._id.toString()));
  } else {
    users = users.filter((u) => activeUserIds.has(u._id.toString()));
  }

  const workload = initWorkload(users, rangeStartKey, rangeEndKey);
  for (const task of tasksWithAssignments) {
    incrementWorkloadForTask(workload, task, rangeStartKey, rangeEndKey);
  }

  const departments = sortDepartmentUsers(
    buildDepartmentsFromUsers(users),
    workload,
    rangeStartKey,
    rangeEndKey
  );

  return {
    start: rangeStartKey,
    end: rangeEndKey,
    departments,
    tasks: tasksWithAssignments,
  };
}

module.exports = {
  getScheduleForUser,
  parseDateRange,
};
