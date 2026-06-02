const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Task = require('../models/Task');
const TaskAssignment = require('../models/TaskAssignment');
const Project = require('../models/Project');
const { protect } = require('../middleware/authMiddleware');
const { format, addDays, startOfDay, endOfDay, parseISO } = require('date-fns');

router.use(protect);

const parseDateRange = (start, end) => {
  const startDate = start ? startOfDay(parseISO(start)) : startOfDay(new Date());
  const endDate = end ? endOfDay(parseISO(end)) : endOfDay(addDays(new Date(), 1));
  return { startDate, endDate };
};

const getScheduleDate = (task) => {
  if (task.scheduleDate) return startOfDay(new Date(task.scheduleDate));
  if (task.startDate) return startOfDay(new Date(task.startDate));
  if (task.dueDate) return startOfDay(new Date(task.dueDate));
  return null;
};

const resolveTaskRange = (task) => {
  const pick = (field) => (field ? startOfDay(new Date(field)) : null);
  let start = pick(task.startDate) || pick(task.scheduleDate) || pick(task.dueDate);
  let end = pick(task.dueDate) || pick(task.startDate) || pick(task.scheduleDate);
  if (!start && !end) return null;
  if (!start) start = end;
  if (!end) end = start;
  if (start > end) [start, end] = [end, start];
  return { start, end };
};

const taskOverlapsRange = (task, rangeStart, rangeEnd) => {
  const span = resolveTaskRange(task);
  if (!span) return false;
  return span.start <= rangeEnd && span.end >= rangeStart;
};

const totalTasksForUser = (uid, workload, startDate, endDate) => {
  let total = 0;
  let cursor = startOfDay(startDate);
  while (cursor <= endDate) {
    total += workload[uid]?.[format(cursor, 'yyyy-MM-dd')]?.totalTasks || 0;
    cursor = addDays(cursor, 1);
  }
  return total;
};

/** Broad MongoDB pre-filter — superset of tasks that may overlap the visible range. */
const buildTaskDatePrefilter = (startDate, endDate) => ({
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

router.get('/', async (req, res) => {
  try {
    const { start, end, projectId, departmentId } = req.query;
    const { startDate, endDate } = parseDateRange(start, end);

    let userProjects = [];
    if (projectId) {
      const project = await Project.findById(projectId).select('_id members owner').lean();
      if (!project) return res.status(404).json({ error: 'Project not found' });
      userProjects = [project];
    } else {
      userProjects = await Project.find({
        $or: [{ owner: req.user._id }, { members: req.user._id }],
      })
        .select('_id members owner')
        .lean();
    }

    const userProjectIds = userProjects.map((p) => p._id);
    const emptyResponse = {
      start: format(startDate, 'yyyy-MM-dd'),
      end: format(endDate, 'yyyy-MM-dd'),
      departments: [],
      tasks: [],
    };

    if (!projectId && userProjectIds.length === 0) {
      return res.json(emptyResponse);
    }

    const taskFilter = {
      ...(projectId
        ? { projectId }
        : { projectId: { $in: userProjectIds } }),
      ...buildTaskDatePrefilter(startDate, endDate),
    };

    const candidateTasks = await Task.find(taskFilter)
      .select('title status scheduleSlot scheduleDate startDate dueDate projectId workspace color')
      .populate('projectId', 'name workspace color')
      .lean();

    const scheduleTasks = candidateTasks.filter((task) => taskOverlapsRange(task, startDate, endDate));
    if (scheduleTasks.length === 0 && projectId) {
      const memberIds = collectProjectMemberIds(userProjects);
      if (memberIds.size === 0) return res.json(emptyResponse);

      const userFilter = { _id: { $in: [...memberIds] } };
      if (departmentId) userFilter.departmentId = departmentId;

      const users = await User.find(userFilter)
        .select('name avatar departmentId')
        .populate('departmentId', 'name slug color sortOrder')
        .sort('name')
        .lean();

      const deptMap = new Map();
      for (const user of users) {
        const dept = user.departmentId || {
          _id: 'unassigned',
          name: 'Unassigned',
          slug: 'unassigned',
          color: '#6b7280',
          sortOrder: 999,
        };
        const deptKey = dept._id?.toString() || 'unassigned';
        if (!deptMap.has(deptKey)) deptMap.set(deptKey, { department: dept, users: [] });
        deptMap.get(deptKey).users.push({ _id: user._id, name: user.name, avatar: user.avatar });
      }

      const departments = [...deptMap.values()].sort(
        (a, b) => (a.department.sortOrder ?? 999) - (b.department.sortOrder ?? 999)
      );

      return res.json({ ...emptyResponse, departments });
    }

    if (scheduleTasks.length === 0) {
      return res.json(emptyResponse);
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

    const tasksWithAssignments = scheduleTasks.map((task) => ({
      ...task,
      assignments: assignmentMap[task._id.toString()] || [],
    }));

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

    const workload = {};
    for (const user of users) {
      const uid = user._id.toString();
      workload[uid] = {};
      let cursor = startOfDay(startDate);
      while (cursor <= endDate) {
        const key = format(cursor, 'yyyy-MM-dd');
        workload[uid][key] = { amCount: 0, pmCount: 0, fullCount: 0, totalTasks: 0, plannedHours: 0 };
        cursor = addDays(cursor, 1);
      }
    }

    for (const task of tasksWithAssignments) {
      const dateKey = format(getScheduleDate(task), 'yyyy-MM-dd');
      const slot = task.scheduleSlot || 'FULL';
      for (const a of task.assignments) {
        const uid = a.userId.toString();
        if (!workload[uid]?.[dateKey]) continue;
        workload[uid][dateKey].totalTasks += 1;
        if (slot === 'AM') workload[uid][dateKey].amCount += 1;
        else if (slot === 'PM') workload[uid][dateKey].pmCount += 1;
        else workload[uid][dateKey].fullCount += 1;
      }
    }

    const deptMap = new Map();
    for (const user of users) {
      const dept = user.departmentId || {
        _id: 'unassigned',
        name: 'Unassigned',
        slug: 'unassigned',
        color: '#6b7280',
        sortOrder: 999,
      };
      const deptKey = dept._id?.toString() || 'unassigned';
      if (!deptMap.has(deptKey)) {
        deptMap.set(deptKey, { department: dept, users: [] });
      }
      deptMap.get(deptKey).users.push({
        _id: user._id,
        name: user.name,
        avatar: user.avatar,
      });
    }

    const departments = [...deptMap.values()].sort(
      (a, b) => (a.department.sortOrder ?? 999) - (b.department.sortOrder ?? 999)
    );

    for (const group of departments) {
      group.users.sort((a, b) => {
        const aTotal = totalTasksForUser(a._id.toString(), workload, startDate, endDate);
        const bTotal = totalTasksForUser(b._id.toString(), workload, startDate, endDate);
        if (bTotal !== aTotal) return bTotal - aTotal;
        return a.name.localeCompare(b.name);
      });
    }

    res.json({
      start: format(startDate, 'yyyy-MM-dd'),
      end: format(endDate, 'yyyy-MM-dd'),
      departments,
      tasks: tasksWithAssignments,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
