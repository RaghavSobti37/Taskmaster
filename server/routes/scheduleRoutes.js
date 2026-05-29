const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Department = require('../models/Department');
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

const totalTasksForUser = (uid, workload, startDate, endDate) => {
  let total = 0;
  let cursor = startOfDay(startDate);
  while (cursor <= endDate) {
    total += workload[uid]?.[format(cursor, 'yyyy-MM-dd')]?.totalTasks || 0;
    cursor = addDays(cursor, 1);
  }
  return total;
};

router.get('/', async (req, res) => {
  try {
    const { start, end, projectId, departmentId } = req.query;
    const { startDate, endDate } = parseDateRange(start, end);

    let userProjectIds = [];
    if (!projectId) {
      const userProjects = await Project.find({
        $or: [{ owner: req.user._id }, { members: req.user._id }]
      }).select('_id members owner').lean();
      userProjectIds = userProjects.map((p) => p._id.toString());
    }

    let userFilter = {};
    if (departmentId) userFilter.departmentId = departmentId;

    if (projectId) {
      const project = await Project.findById(projectId).lean();
      if (!project) return res.status(404).json({ error: 'Project not found' });
      userFilter._id = { $in: [...(project.members || []), project.owner].filter(Boolean) };
    }

    let users = await User.find(userFilter)
      .select('name email avatar role departmentId')
      .populate('departmentId', 'name slug color sortOrder')
      .sort('name')
      .lean();

    const userIds = users.map((u) => u._id);
    const assignments = await TaskAssignment.find({ userId: { $in: userIds } }).lean();
    const taskIds = [...new Set(assignments.map((a) => a.taskId.toString()))];

    const taskFilter = { _id: { $in: taskIds } };
    if (projectId) {
      taskFilter.projectId = projectId;
    } else if (userProjectIds.length) {
      taskFilter.projectId = { $in: userProjectIds };
    } else {
      taskFilter.projectId = { $in: [] };
    }

    const tasks = await Task.find(taskFilter)
      .select('title status priority type scheduleSlot scheduleDate startDate dueDate projectId plannedHours createdBy color')
      .populate('createdBy', 'name avatar')
      .populate('projectId', 'name color')
      .lean();

    const assignmentMap = {};
    for (const a of assignments) {
      const tid = a.taskId.toString();
      if (!assignmentMap[tid]) assignmentMap[tid] = [];
      assignmentMap[tid].push({ userId: a.userId, assignedBy: a.assignedBy, assignedAt: a.assignedAt });
    }

    const scheduleTasks = [];
    for (const task of tasks) {
      const schedDate = getScheduleDate(task);
      if (!schedDate) continue;
      if (schedDate < startDate || schedDate > endDate) continue;
      scheduleTasks.push({
        ...task,
        assignments: assignmentMap[task._id.toString()] || []
      });
    }

    if (!projectId && userProjectIds.length) {
      const activeUserIds = new Set();
      for (const task of scheduleTasks) {
        for (const a of task.assignments) {
          activeUserIds.add(a.userId.toString());
        }
      }
      for (const pid of userProjectIds) {
        const proj = await Project.findById(pid).select('members owner').lean();
        if (proj) {
          [...(proj.members || []), proj.owner].forEach((id) => activeUserIds.add(id.toString()));
        }
      }
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

    for (const task of scheduleTasks) {
      const dateKey = format(getScheduleDate(task), 'yyyy-MM-dd');
      const slot = task.scheduleSlot || 'FULL';
      for (const a of task.assignments) {
        const uid = a.userId.toString();
        if (!workload[uid]?.[dateKey]) continue;
        workload[uid][dateKey].totalTasks += 1;
        workload[uid][dateKey].plannedHours += task.plannedHours || 0;
        if (slot === 'AM') workload[uid][dateKey].amCount += 1;
        else if (slot === 'PM') workload[uid][dateKey].pmCount += 1;
        else workload[uid][dateKey].fullCount += 1;
      }
    }

    const deptMap = new Map();
    for (const user of users) {
      const dept = user.departmentId || { _id: 'unassigned', name: 'Unassigned', slug: 'unassigned', color: '#6b7280', sortOrder: 999 };
      const deptKey = dept._id?.toString() || 'unassigned';
      if (!deptMap.has(deptKey)) {
        deptMap.set(deptKey, { department: dept, users: [] });
      }
      deptMap.get(deptKey).users.push({
        ...user,
        workload: workload[user._id.toString()] || {}
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
      tasks: scheduleTasks
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
