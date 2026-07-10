/**
 * Dynamic attendance matrix roster visibility — show active users + approved leave.
 */
const ROSTER_LOOKBACK_DAYS = 7;

const VIEW_MODES = {
  DAILY: 'daily',
  COMPACT: 'compact',
  WEEK: 'week',
  MONTH: 'month',
};

const startOfDay = (date) => {
  const value = date instanceof Date ? new Date(date) : new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const addDays = (date, days) => {
  const value = startOfDay(date);
  value.setDate(value.getDate() + days);
  return value;
};

const hasAttendanceActivity = (row) => {
  if (!row) return false;
  const hasCheck = Boolean(
    row.inTimeRecord?.manualTimestamp
    || row.inTimeRecord?.systemTimestamp
    || row.outTimeRecord?.manualTimestamp
    || row.outTimeRecord?.systemTimestamp
  );
  return hasCheck || !!row.onLeave || !!row.isHalfDay;
};

const getUserId = (value) => String(value?._id || value?.id || value || '');

const dateInRange = (date, rangeStart, rangeEnd) => {
  const value = startOfDay(date);
  return value >= startOfDay(rangeStart) && value <= startOfDay(rangeEnd);
};

const leaveOverlapsRange = (leave, rangeStart, rangeEnd) => {
  if (!leave || leave.status !== 'approved') return false;
  const from = startOfDay(leave.fromDate);
  const to = startOfDay(leave.toDate);
  return from <= startOfDay(rangeEnd) && to >= startOfDay(rangeStart);
};

const getLastActivityDate = (userId, rows) => {
  let max = null;
  for (const row of rows || []) {
    if (getUserId(row.userId) !== getUserId(userId)) continue;
    if (!hasAttendanceActivity(row)) continue;
    const value = startOfDay(row.date);
    if (!max || value > max) max = value;
  }
  return max;
};

const userHasActivityInRange = (userId, rows, rangeStart, rangeEnd) =>
  (rows || []).some(
    (row) => getUserId(row.userId) === getUserId(userId)
      && hasAttendanceActivity(row)
      && dateInRange(row.date, rangeStart, rangeEnd)
  );

const userHasApprovedLeaveInRange = (userId, approvedLeaves, rangeStart, rangeEnd) =>
  (approvedLeaves || []).some(
    (leave) => getUserId(leave.userId) === getUserId(userId)
      && leaveOverlapsRange(leave, rangeStart, rangeEnd)
  );

const isUserVisibleInRoster = ({
  user,
  activityRows = [],
  monthActivityRows = [],
  approvedLeaves = [],
  today = new Date(),
  viewMode = VIEW_MODES.DAILY,
  monthRange = null,
}) => {
  if (!user) return false;
  const uid = getUserId(user);
  const todayStart = startOfDay(today);
  const lookbackStart = addDays(todayStart, -(ROSTER_LOOKBACK_DAYS - 1));

  const lastActivity = getLastActivityDate(uid, activityRows);
  const recentActivity = lastActivity && lastActivity >= lookbackStart && lastActivity <= todayStart;

  if (recentActivity) return true;
  if (userHasApprovedLeaveInRange(uid, approvedLeaves, lookbackStart, todayStart)) return true;

  if (viewMode === VIEW_MODES.MONTH && monthRange?.start && monthRange?.end) {
    const monthStart = startOfDay(monthRange.start);
    const monthEnd = startOfDay(monthRange.end);
    if (userHasActivityInRange(uid, monthActivityRows, monthStart, monthEnd)) return true;
    if (userHasApprovedLeaveInRange(uid, approvedLeaves, monthStart, monthEnd)) return true;
  }

  return false;
};

const filterAttendanceRosterUsers = ({
  users = [],
  activityRows = [],
  monthActivityRows = [],
  approvedLeaves = [],
  today = new Date(),
  viewMode = VIEW_MODES.DAILY,
  monthRange = null,
}) =>
  users.filter((user) => isUserVisibleInRoster({
    user,
    activityRows,
    monthActivityRows,
    approvedLeaves,
    today,
    viewMode,
    monthRange,
  }));

const isDateOnApprovedLeave = (userId, date, approvedLeaves = []) =>
  (approvedLeaves || []).some(
    (leave) => getUserId(leave.userId) === getUserId(userId)
      && leaveOverlapsRange(leave, date, date)
  );

const buildVirtualLeaveEntry = (userId, date, approvedLeaves = []) => {
  const leave = (approvedLeaves || []).find(
    (item) => getUserId(item.userId) === getUserId(userId)
      && leaveOverlapsRange(item, date, date)
  );
  if (!leave) return null;
  return {
    userId: getUserId(userId),
    date: startOfDay(date),
    onLeave: true,
    reason: leave.reason || '',
  };
};

module.exports = {
  ROSTER_LOOKBACK_DAYS,
  VIEW_MODES,
  hasAttendanceActivity,
  leaveOverlapsRange,
  getLastActivityDate,
  isUserVisibleInRoster,
  filterAttendanceRosterUsers,
  isDateOnApprovedLeave,
  buildVirtualLeaveEntry,
};
