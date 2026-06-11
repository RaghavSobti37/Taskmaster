const User = require('../models/User');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const { isAttendanceExcluded } = require('./attendanceUsers');
const {
  filterAttendanceRosterUsers,
  ROSTER_LOOKBACK_DAYS,
  VIEW_MODES,
} = require('../../shared/attendanceRosterVisibility');
const { toStartOfDay, endOfDayFromKey, todayStart } = require('./attendanceDate');

const addDays = (date, days) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() + days);
  return value;
};

const resolveViewMode = (raw) => {
  const modes = Object.values(VIEW_MODES);
  return modes.includes(raw) ? raw : VIEW_MODES.DAILY;
};

/**
 * Server-side attendance matrix roster — excludes test/QA accounts and inactive staff;
 * keeps users on approved leave visible.
 */
async function getVisibleRosterUsers({
  viewMode = VIEW_MODES.DAILY,
  monthStart,
  monthEnd,
  today = todayStart(),
} = {}) {
  const mode = resolveViewMode(viewMode);
  const todayDate = toStartOfDay(today);
  const lookbackStart = addDays(todayDate, -(ROSTER_LOOKBACK_DAYS - 1));

  const users = await User.find()
    .select('name email username departmentId lastOnline')
    .populate('departmentId', 'name slug permissionPreset')
    .lean();

  const baseUsers = users.filter((user) => !isAttendanceExcluded(user));

  const [activityRows, approvedLeaves] = await Promise.all([
    Attendance.find({
      date: { $gte: lookbackStart, $lte: todayDate },
      userId: { $in: baseUsers.map((u) => u._id) },
    }).lean(),
    LeaveRequest.find({ status: 'approved' }).lean(),
  ]);

  let monthActivityRows = [];
  if (mode === VIEW_MODES.MONTH && monthStart && monthEnd) {
    monthActivityRows = await Attendance.find({
      date: {
        $gte: toStartOfDay(monthStart),
        $lte: endOfDayFromKey(monthEnd),
      },
      userId: { $in: baseUsers.map((u) => u._id) },
    }).lean();
  }

  return filterAttendanceRosterUsers({
    users: baseUsers,
    activityRows,
    monthActivityRows,
    approvedLeaves,
    today: todayDate,
    viewMode: mode,
    monthRange: mode === VIEW_MODES.MONTH && monthStart && monthEnd
      ? { start: toStartOfDay(monthStart), end: toStartOfDay(monthEnd) }
      : null,
  });
}

module.exports = {
  getVisibleRosterUsers,
};
