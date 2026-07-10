const {
  LUNCH_BREAK_MINUTES,
  UNLOGGED_THRESHOLD_MINUTES,
  getWorkedMinutesFromTimes,
  sumDailyLogMinutes,
  computeExpectedLogMinutes,
  computeUnloggedMinutes,
  buildAttendanceMetrics,
} = require('../../shared/attendanceMetrics');

const STANDARD_SHIFT_MINUTES = 8 * 60;

/** @deprecated use getWorkedMinutesFromTimes — kept for tests */
const getSystemMinutesFromTimes = getWorkedMinutesFromTimes;

function buildAttendanceMetricsWithOvertime(args) {
  const metrics = buildAttendanceMetrics({
    inTime: args.inTime,
    outTime: args.outTime,
    logs: args.logs,
    loggedMinutes: args.loggedMinutes,
  });
  const workedMinutes = metrics.workedMinutes;
  return {
    ...metrics,
    discrepancyMinutes: metrics.unloggedMinutes,
    overtimeMinutes: Math.max(0, workedMinutes - STANDARD_SHIFT_MINUTES),
  };
}

module.exports = {
  STANDARD_SHIFT_MINUTES,
  LUNCH_BREAK_MINUTES,
  UNLOGGED_THRESHOLD_MINUTES,
  getSystemMinutesFromTimes,
  getWorkedMinutesFromTimes,
  sumDailyLogMinutes,
  computeExpectedLogMinutes,
  computeUnloggedMinutes,
  buildAttendanceMetrics: buildAttendanceMetricsWithOvertime,
};
