/** Client ESM mirror of shared/attendanceRosterVisibility.js — keep in sync */

import { format } from 'date-fns';

export const ROSTER_LOOKBACK_DAYS = 7;

export const ROSTER_VIEW_MODES = {
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

export const hasAttendanceActivity = (row) => {
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

export const leaveOverlapsRange = (leave, rangeStart, rangeEnd) => {
  if (!leave || leave.status !== 'approved') return false;
  const from = startOfDay(leave.fromDate);
  const to = startOfDay(leave.toDate);
  return from <= startOfDay(rangeEnd) && to >= startOfDay(rangeStart);
};

export const getLastActivityDate = (userId, rows) => {
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

export const isUserVisibleInRoster = ({
  user,
  activityRows = [],
  monthActivityRows = [],
  approvedLeaves = [],
  today = new Date(),
  viewMode = ROSTER_VIEW_MODES.DAILY,
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

  if (viewMode === ROSTER_VIEW_MODES.MONTH && monthRange?.start && monthRange?.end) {
    const monthStart = startOfDay(monthRange.start);
    const monthEnd = startOfDay(monthRange.end);
    if (userHasActivityInRange(uid, monthActivityRows, monthStart, monthEnd)) return true;
    if (userHasApprovedLeaveInRange(uid, approvedLeaves, monthStart, monthEnd)) return true;
  }

  return false;
};

export const filterAttendanceRosterUsers = ({
  users = [],
  activityRows = [],
  monthActivityRows = [],
  approvedLeaves = [],
  today = new Date(),
  viewMode = ROSTER_VIEW_MODES.DAILY,
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

export const isDateOnApprovedLeave = (userId, date, approvedLeaves = []) =>
  (approvedLeaves || []).some(
    (leave) => getUserId(leave.userId) === getUserId(userId)
      && leaveOverlapsRange(leave, date, date)
  );

export const buildVirtualLeaveEntry = (userId, date, approvedLeaves = []) => {
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

export const getRowMapKey = (userId, date) =>
  `${getUserId(userId)}_${format(date instanceof Date ? date : new Date(date), 'yyyy-MM-dd')}`;

export const resolveRowEntry = (rowMap, userId, date, approvedLeaves = []) => {
  const key = getRowMapKey(userId, date);
  const existing = rowMap.get(key);
  if (existing) return existing;
  return buildVirtualLeaveEntry(userId, date, approvedLeaves);
};
