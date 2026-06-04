const { parseTimeSpentToMinutes } = require('./timeSpent');
const { toDateKey } = require('./dateValidation');

const LUNCH_BREAK_MINUTES = 60;
const UNLOGGED_THRESHOLD_MINUTES = 30;

/** Read minutes from a daily log row (manual, task completion, or review). */
function readLogTimeSpentMinutes(log) {
  const details = log?.details || {};
  const payload = log?.payload || {};
  const raw = details.timeSpent ?? details.time ?? payload.timeSpent ?? payload.time;
  if (raw == null || raw === '') {
    const hours = Number(details.hours);
    if (Number.isFinite(hours) && hours > 0) return Math.round(hours * 60);
    return 0;
  }
  if (typeof raw === 'number') {
    return raw > 24 ? Math.round(raw) : Math.round(raw * 60);
  }
  return parseTimeSpentToMinutes(raw);
}

/** Keep logs whose createdAt falls on the same app calendar day (IST) as dateKey. */
function filterLogsForDateKey(logs = [], dateKey) {
  if (!dateKey) return [];
  return logs.filter((log) => toDateKey(log.createdAt) === dateKey);
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
