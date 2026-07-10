const { getLogWorkDateKey, readLogTimeSpentMinutes: readDailyLogMinutes } = require('./dailyLogDetails');

const LUNCH_BREAK_MINUTES = 60;
const UNLOGGED_THRESHOLD_MINUTES = 30;

/** Read minutes from a daily log row (interval, timeSpent string, or legacy hours). */
function readLogTimeSpentMinutes(log) {
  return readDailyLogMinutes(log);
}

/** Keep logs whose work date (or legacy createdAt) matches dateKey. */
function filterLogsForDateKey(logs = [], dateKey) {
  if (!dateKey) return [];
  return logs.filter((log) => getLogWorkDateKey(log) === dateKey);
}

function parseClockToMinutes(timeStr) {
  if (!timeStr || !String(timeStr).includes(':')) return 0;
  const [h, m] = String(timeStr).split(':').map(Number);
  return (h * 60) + (m || 0);
}

function getWorkedMinutesFromTimes(inTime, outTime) {
  if (!inTime || !outTime) return 0;
  let minutes = parseClockToMinutes(outTime) - parseClockToMinutes(inTime);
  if (minutes < 0) minutes += 24 * 60;
  return minutes;
}

function sumDailyLogMinutes(logs = []) {
  return logs.reduce((sum, log) => sum + readLogTimeSpentMinutes(log), 0);
}

function computeExpectedLogMinutes(workedMinutes) {
  return Math.max(0, workedMinutes - LUNCH_BREAK_MINUTES);
}

function computeUnloggedMinutes(workedMinutes, loggedMinutes) {
  const expected = computeExpectedLogMinutes(workedMinutes);
  return Math.max(0, expected - loggedMinutes);
}

function buildAttendanceMetrics({ inTime, outTime, logs = [], loggedMinutes: loggedOverride } = {}) {
  const workedMinutes = getWorkedMinutesFromTimes(inTime, outTime);
  const loggedMinutes = loggedOverride != null
    ? loggedOverride
    : sumDailyLogMinutes(logs);
  const unloggedMinutes = computeUnloggedMinutes(workedMinutes, loggedMinutes);

  return {
    workedMinutes,
    loggedMinutes,
    expectedLogMinutes: computeExpectedLogMinutes(workedMinutes),
    unloggedMinutes,
    systemHours: Math.round((workedMinutes / 60) * 100) / 100,
    loggedHours: Math.round((loggedMinutes / 60) * 100) / 100,
  };
}

module.exports = {
  LUNCH_BREAK_MINUTES,
  UNLOGGED_THRESHOLD_MINUTES,
  readLogTimeSpentMinutes,
  filterLogsForDateKey,
  parseClockToMinutes,
  getWorkedMinutesFromTimes,
  sumDailyLogMinutes,
  computeExpectedLogMinutes,
  computeUnloggedMinutes,
  buildAttendanceMetrics,
};
