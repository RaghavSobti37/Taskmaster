const User = require('../models/User');
const Task = require('../models/Task');
const TaskAssignment = require('../models/TaskAssignment');
const Project = require('../models/Project');
const Attendance = require('../models/Attendance');
const CalendarEvent = require('../models/CalendarEvent');
const Log = require('../models/Log');

const parseMonth = (monthParam) => {
  if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
    throw new Error('month query param required (YYYY-MM)');
  }
  const [year, month] = monthParam.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);
  return { monthParam, startDate, endDate };
};

const groupBy = (items, keyFn) => {
  const map = new Map();
  items.forEach((item) => {
    const key = keyFn(item);
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  return map;
};

const parseLogHours = (raw) => {
  const str = String(raw || '0').trim().toLowerCase();
  if (!str) return 0;
  if (str.includes('h')) return parseFloat(str.replace('h', '')) || 0;
  if (str.includes('m')) return (parseFloat(str.replace('m', '')) || 0) / 60;
  return parseFloat(str) || 0;
};

const formatLogEntry = (log, userName) => {
  const created = log.createdAt || log.timestamp;
  const d = new Date(created);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    userId: log.userId?.toString?.() || log.userId,
    userName: userName || '',
    date: d.toISOString().split('T')[0],
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    title: log.details?.title || log.payload?.title || 'Untitled',
    project: log.details?.project || log.payload?.project || 'GENERAL',
    timeSpent: log.details?.timeSpent || log.payload?.timeSpent || '0m',
    message: log.details?.message || log.payload?.message || '',
  };
};

const buildAttendanceSummary = (rows) => {
  let present = 0;
  let halfDay = 0;
  let leave = 0;
  let empty = 0;
  const attendanceByDay = [];

  rows.forEach((row) => {
    const dayKey = row.date.toISOString().split('T')[0];
    let status = 'empty';
    if (row.onLeave) {
      status = 'leave';
      leave += 1;
    } else if (row.isHalfDay) {
      status = 'halfDay';
      halfDay += 1;
    } else if (row.timeIn || row.timeOut) {
      status = 'present';
      present += 1;
    } else {
      empty += 1;
    }
    attendanceByDay.push({
      date: dayKey,
      status,
      timeIn: row.timeIn || '',
      timeOut: row.timeOut || '',
      isApproved: !!row.isApproved,
    });
  });

  return {
    present,
    halfDay,
    leave,
    empty,
    byDay: attendanceByDay,
    chart: attendanceByDay.map((d) => ({
      date: d.date,
      value: d.status === 'present' ? 1 : d.status === 'halfDay' ? 0.5 : 0,
    })),
  };
};

const buildTaskSummary = (assignedTasks, startDate, endDate) => {
  const tasksInMonth = assignedTasks.filter((t) => {
    const ref = t.completedAt || t.dueDate || t.createdAt;
    if (!ref) return false;
    const d = new Date(ref);
    return d >= startDate && d <= endDate;
  });

  return {
    total: assignedTasks.length,
    completed: assignedTasks.filter((t) => t.status === 'done').length,
    inProgress: assignedTasks.filter((t) => t.status === 'in-progress').length,
    todo: assignedTasks.filter((t) => t.status === 'todo').length,
    inReview: assignedTasks.filter((t) => t.status === 'in-review').length,
    overdue: assignedTasks.filter((t) => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < new Date()).length,
    byPriority: {
      critical: assignedTasks.filter((t) => t.priority === 'critical').length,
      high: assignedTasks.filter((t) => t.priority === 'high').length,
      medium: assignedTasks.filter((t) => t.priority === 'medium').length,
      low: assignedTasks.filter((t) => t.priority === 'low').length,
    },
    monthActivity: tasksInMonth.map((t) => ({
      title: t.title,
      status: t.status,
      priority: t.priority,
      date: (t.completedAt || t.dueDate || t.createdAt)?.toISOString?.()?.split('T')[0],
    })),
  };
};

const buildLogsSummary = (logs, userName) => {
  const logsByDayMap = new Map();
  const entries = logs.map((log) => {
    const day = (log.createdAt || log.timestamp).toISOString().split('T')[0];
    const hours = parseLogHours(log.details?.timeSpent || log.payload?.timeSpent);
    const existing = logsByDayMap.get(day) || { hours: 0, count: 0 };
    logsByDayMap.set(day, { hours: existing.hours + hours, count: existing.count + 1 });
    return formatLogEntry(log, userName);
  });
  const byDay = [...logsByDayMap.entries()]
    .map(([date, { hours, count }]) => ({ date, hours, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    totalEntries: logs.length,
    totalHours: byDay.reduce((s, d) => s + d.hours, 0),
    byDay,
    entries,
  };
};

const buildBulkMonthlyReports = async (userIds, monthParam) => {
  if (!userIds.length) return [];

  const { monthParam: month, startDate, endDate } = parseMonth(monthParam);
  const period = { start: startDate.toISOString(), end: endDate.toISOString() };
  const idStrings = userIds.map(String);

  const users = await User.find({ _id: { $in: userIds } })
    .select('name email departmentId')
    .populate('departmentId', 'name')
    .lean();

  const [attendanceRows, assignments, allLogs, allProjects] = await Promise.all([
    Attendance.find({ userId: { $in: userIds }, date: { $gte: startDate, $lte: endDate } }).lean(),
    TaskAssignment.find({ userId: { $in: userIds } }).lean(),
    Log.find({
      action: 'DAILY_LOG',
      createdAt: { $gte: startDate, $lte: endDate },
      $or: [{ userId: { $in: userIds } }, { actorId: { $in: idStrings } }],
    }).sort({ createdAt: 1 }).lean(),
    Project.find({ members: { $in: userIds } }).select('name status workspace progress members').lean(),
  ]);

  const taskIds = [...new Set(assignments.map((a) => a.taskId?.toString()).filter(Boolean))];
  const allTasks = taskIds.length
    ? await Task.find({ _id: { $in: taskIds } }).select('title status priority dueDate completedAt createdAt projectId').lean()
    : [];

  const allProjectIds = allProjects.map((p) => p._id);
  const calendarEvents = await CalendarEvent.find({
    date: { $gte: startDate, $lte: endDate },
    $or: [
      { createdBy: { $in: userIds } },
      { visibility: 'public' },
      ...(allProjectIds.length ? [{ visibility: 'project', projectId: { $in: allProjectIds } }] : []),
    ],
  }).select('title date eventType visibility createdBy projectId').lean();

  const tasksById = Object.fromEntries(allTasks.map((t) => [t._id.toString(), t]));
  const attendanceByUser = groupBy(attendanceRows, (r) => r.userId?.toString());
  const assignmentsByUser = groupBy(assignments, (a) => a.userId?.toString());

  const logsByUser = new Map();
  allLogs.forEach((log) => {
    const uid = log.userId?.toString?.() || log.userId;
    const actor = log.actorId?.toString?.() || log.actorId;
    if (uid) {
      if (!logsByUser.has(uid)) logsByUser.set(uid, []);
      logsByUser.get(uid).push(log);
    }
    if (actor && actor !== uid) {
      if (!logsByUser.has(actor)) logsByUser.set(actor, []);
      if (!logsByUser.get(actor).includes(log)) logsByUser.get(actor).push(log);
    }
  });

  const projectsByUser = new Map();
  allProjects.forEach((p) => {
    (p.members || []).forEach((memberId) => {
      const key = memberId.toString();
      if (!projectsByUser.has(key)) projectsByUser.set(key, []);
      projectsByUser.get(key).push(p);
    });
  });

  const userProjectIdsByUser = new Map();
  allProjects.forEach((p) => {
    (p.members || []).forEach((memberId) => {
      const key = memberId.toString();
      if (!userProjectIdsByUser.has(key)) userProjectIdsByUser.set(key, []);
      userProjectIdsByUser.get(key).push(p._id);
    });
  });

  return users.map((user) => {
    const uid = user._id.toString();
    const userAttendance = attendanceByUser.get(uid) || [];
    const userAssignments = assignmentsByUser.get(uid) || [];
    const userTaskIds = userAssignments.map((a) => a.taskId?.toString()).filter(Boolean);
    const assignedTasks = userTaskIds.map((id) => tasksById[id]).filter(Boolean);
    const userLogs = logsByUser.get(uid) || [];
    const userProjects = projectsByUser.get(uid) || [];
    const userProjectIds = userProjectIdsByUser.get(uid) || [];

    const userCalendar = calendarEvents.filter((e) => {
      if (e.createdBy?.toString() === uid) return true;
      if (e.visibility === 'public') return true;
      if (e.visibility === 'project' && e.projectId && userProjectIds.some((id) => id.toString() === e.projectId.toString())) {
        return true;
      }
      return false;
    });

    const attendance = buildAttendanceSummary(userAttendance);
    const logs = buildLogsSummary(userLogs, user.name);

    return {
      user: { _id: user._id, name: user.name, email: user.email, department: user.departmentId?.name },
      month,
      period,
      attendance,
      tasks: buildTaskSummary(assignedTasks, startDate, endDate),
      logs,
      calendar: {
        total: userCalendar.length,
        events: userCalendar.map((e) => ({
          title: e.title,
          date: e.date?.toISOString?.()?.split('T')[0],
          eventType: e.eventType,
          visibility: e.visibility,
        })),
      },
      projects: {
        total: userProjects.length,
        active: userProjects.filter((p) => p.status === 'active').length,
        completed: userProjects.filter((p) => p.status === 'completed').length,
        archived: userProjects.filter((p) => p.status === 'archived').length,
        items: userProjects.map((p) => ({
          name: p.name,
          status: p.status,
          workspace: p.workspace,
          progress: p.progress,
        })),
      },
    };
  });
};

const buildUserMonthlyReport = async (userId, monthParam) => {
  const reports = await buildBulkMonthlyReports([userId], monthParam);
  if (!reports.length) throw new Error('User not found');
  return reports[0];
};

const mergeByDay = (reports, keyPath) => {
  const map = new Map();
  reports.forEach((report) => {
    const items = keyPath.split('.').reduce((obj, k) => obj?.[k], report) || [];
    items.forEach(({ date, hours, value, count }) => {
      const existing = map.get(date) || { date, hours: 0, value: 0, count: 0 };
      if (hours !== undefined) existing.hours += hours;
      if (value !== undefined) existing.value += value;
      if (count !== undefined) existing.count += count;
      map.set(date, existing);
    });
  });
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
};

const emptyAggregate = (monthParam, { scope, department } = {}) => ({
  scope,
  department,
  month: monthParam,
  period: null,
  members: [],
  totals: {
    present: 0, halfDay: 0, leave: 0, tasksCompleted: 0, tasksInProgress: 0,
    tasksTodo: 0, tasksInReview: 0, logHours: 0, calendarEvents: 0, projects: 0,
  },
  attendance: { present: 0, halfDay: 0, leave: 0, empty: 0, chart: [] },
  tasks: { completed: 0, inProgress: 0, todo: 0, inReview: 0, total: 0, overdue: 0 },
  logs: { totalEntries: 0, totalHours: 0, byDay: [], entries: [] },
  calendar: { total: 0, events: [] },
  projects: { total: 0, items: [] },
});

const aggregateReports = (reports, { scope, department, monthParam } = {}) => {
  if (!reports.length) return emptyAggregate(monthParam, { scope, department });

  const members = reports.map((r) => ({
    _id: r.user._id,
    name: r.user.name,
    email: r.user.email,
    department: r.user.department,
    attendance: {
      present: r.attendance.present,
      halfDay: r.attendance.halfDay,
      leave: r.attendance.leave,
    },
    tasks: {
      completed: r.tasks.completed,
      inProgress: r.tasks.inProgress,
      total: r.tasks.total,
    },
    logs: { totalHours: r.logs.totalHours, entryCount: r.logs.totalEntries },
  }));

  const totals = {
    present: reports.reduce((s, r) => s + r.attendance.present, 0),
    halfDay: reports.reduce((s, r) => s + r.attendance.halfDay, 0),
    leave: reports.reduce((s, r) => s + r.attendance.leave, 0),
    tasksCompleted: reports.reduce((s, r) => s + r.tasks.completed, 0),
    tasksInProgress: reports.reduce((s, r) => s + r.tasks.inProgress, 0),
    tasksTodo: reports.reduce((s, r) => s + r.tasks.todo, 0),
    tasksInReview: reports.reduce((s, r) => s + r.tasks.inReview, 0),
    logHours: reports.reduce((s, r) => s + r.logs.totalHours, 0),
    calendarEvents: reports.reduce((s, r) => s + r.calendar.total, 0),
    projects: reports.reduce((s, r) => s + r.projects.total, 0),
  };

  const allLogEntries = reports
    .flatMap((r) => r.logs.entries.map((e) => ({ ...e, userName: e.userName || r.user.name })))
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))
    .slice(0, 100);

  return {
    scope,
    department,
    month: reports[0].month,
    period: reports[0].period,
    members,
    totals,
    attendance: {
      present: totals.present,
      halfDay: totals.halfDay,
      leave: totals.leave,
      empty: reports.reduce((s, r) => s + r.attendance.empty, 0),
      chart: mergeByDay(reports, 'attendance.chart'),
    },
    tasks: {
      total: reports.reduce((s, r) => s + r.tasks.total, 0),
      completed: totals.tasksCompleted,
      inProgress: totals.tasksInProgress,
      todo: totals.tasksTodo,
      inReview: totals.tasksInReview,
      overdue: reports.reduce((s, r) => s + r.tasks.overdue, 0),
    },
    logs: {
      totalEntries: reports.reduce((s, r) => s + r.logs.totalEntries, 0),
      totalHours: totals.logHours,
      byDay: mergeByDay(reports, 'logs.byDay'),
      entries: allLogEntries,
    },
    calendar: {
      total: totals.calendarEvents,
      events: reports.flatMap((r) => r.calendar.events).slice(0, 50),
    },
    projects: {
      total: totals.projects,
      items: reports.flatMap((r) => r.projects.items).slice(0, 50),
    },
  };
};

const buildDepartmentMonthlyReport = async (departmentId, monthParam) => {
  const Department = require('../models/Department');
  const dept = await Department.findById(departmentId).lean();
  if (!dept) throw new Error('Department not found');

  const users = await User.find({ departmentId }).select('_id').lean();
  const userIds = users.map((u) => u._id);
  const reports = await buildBulkMonthlyReports(userIds, monthParam);

  return aggregateReports(reports, {
    scope: 'department',
    monthParam,
    department: { _id: dept._id, name: dept.name, memberCount: users.length },
  });
};

const buildTeamMonthlyReport = async (monthParam) => {
  const users = await User.find({}).select('_id').lean();
  const userIds = users.map((u) => u._id);
  const reports = await buildBulkMonthlyReports(userIds, monthParam);

  return aggregateReports(reports, {
    scope: 'team',
    monthParam,
    department: { name: 'All Teams', memberCount: users.length },
  });
};

module.exports = {
  parseMonth,
  buildUserMonthlyReport,
  buildBulkMonthlyReports,
  aggregateReports,
  buildDepartmentMonthlyReport,
  buildTeamMonthlyReport,
};
