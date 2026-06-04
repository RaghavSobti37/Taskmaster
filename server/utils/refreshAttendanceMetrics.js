const Attendance = require('../models/Attendance');
const Log = require('../models/Log');
const { buildAttendanceMetrics } = require('./attendanceMetrics');
const { sumDailyLogMinutes } = require('../../shared/attendanceMetrics');
const { getDateKey, toStartOfDay, endOfDayFromKey } = require('./attendanceDate');

async function fetchDailyLogMinutesForDay(userId, dateInput) {
  const dateKey = getDateKey(dateInput);
  const dayStart = toStartOfDay(dateInput);
  const dayEnd = endOfDayFromKey(dateKey);
  const logs = await Log.find({
    userId,
    action: 'DAILY_LOG',
    createdAt: { $gte: dayStart, $lte: dayEnd },
  }).select('details.timeSpent').lean();
  return sumDailyLogMinutes(logs);
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
  return refreshAttendanceMetricsForUserDay(log.userId, log.createdAt);
}

module.exports = {
  refreshAttendanceMetrics,
  refreshAttendanceMetricsForUserDay,
  refreshAttendanceMetricsFromLog,
};
