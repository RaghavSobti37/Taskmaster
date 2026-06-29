const Attendance = require('../models/Attendance');
const Log = require('../models/Log');
const { buildAttendanceMetrics } = require('./attendanceMetrics');
const {
  sumDailyLogMinutes,
  filterLogsForDateKey,
} = require('../../shared/attendanceMetrics');
const { getDateKey, toStartOfDay } = require('./attendanceDate');

/**
 * Sum all DAILY_LOG minutes for a user on the attendance calendar day (IST).
 * Uses date-key matching (same day as Daily Logs page) and bypassTenant so
 * manual logs are not dropped by tenant scoping or createdAt range edge cases.
 */
async function fetchDailyLogMinutesForDay(userId, dateInput) {
  const dateKey = getDateKey(dateInput);
  if (!dateKey || !userId) return 0;

  const uid = String(userId);
  const logs = await Log.find({
    userId,
    action: 'DAILY_LOG',
  })
    .select('createdAt details payload action')
    .setOptions({ bypassTenant: true })
    .lean();

  const dayLogs = filterLogsForDateKey(logs, dateKey);
  return sumDailyLogMinutes(dayLogs);
}

async function refreshAttendanceMetrics(attendanceDoc) {
  if (!attendanceDoc) return null;
  const inTime = attendanceDoc.inTimeRecord?.manualTimestamp;
  const outTime = attendanceDoc.outTimeRecord?.manualTimestamp;

  if (!inTime || !outTime) return attendanceDoc;

  const loggedMinutes = await fetchDailyLogMinutesForDay(
    attendanceDoc.userId,
    attendanceDoc.date
  );
  const metrics = buildAttendanceMetrics({ inTime, outTime, loggedMinutes });

  attendanceDoc.systemHours = metrics.systemHours;
  attendanceDoc.loggedHours = metrics.loggedHours;
  attendanceDoc.unloggedMinutes = metrics.unloggedMinutes;
  attendanceDoc.discrepancyMinutes = metrics.discrepancyMinutes;
  attendanceDoc.overtimeMinutes = metrics.overtimeMinutes;
  await attendanceDoc.save();

  return attendanceDoc;
}

async function refreshAttendanceMetricsForUserDay(userId, dateInput) {
  const dayStart = toStartOfDay(dateInput);
  const doc = await Attendance.findOne({ userId, date: dayStart });
  if (!doc) return null;
  return refreshAttendanceMetrics(doc);
}

async function refreshAttendanceMetricsFromLog(log) {
  if (!log || log.action !== 'DAILY_LOG') return null;
  const { getLogWorkDateKey } = require('../../shared/dailyLogDetails');
  const dateKey = getLogWorkDateKey(log);
  return refreshAttendanceMetricsForUserDay(log.userId, dateKey);
}

module.exports = {
  fetchDailyLogMinutesForDay,
  refreshAttendanceMetrics,
  refreshAttendanceMetricsForUserDay,
  refreshAttendanceMetricsFromLog,
};
