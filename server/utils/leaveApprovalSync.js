const Attendance = require('../models/Attendance');
const { toStartOfDay } = require('./attendanceDate');

const eachDayInclusive = (start, end) => {
  const days = [];
  let current = toStartOfDay(start);
  const endDay = toStartOfDay(end);
  while (current <= endDay) {
    days.push(new Date(current));
    const next = new Date(current);
    next.setDate(next.getDate() + 1);
    current = toStartOfDay(next);
  }
  return days;
};

const syncApprovedLeaveToAttendance = async (leaveRequest) => {
  const days = eachDayInclusive(leaveRequest.fromDate, leaveRequest.toDate);
  return Promise.all(
    days.map((date) =>
      Attendance.findOneAndUpdate(
        { userId: leaveRequest.userId, date: toStartOfDay(date) },
        {
          $set: {
            userId: leaveRequest.userId,
            username: leaveRequest.username,
            date: toStartOfDay(date),
            onLeave: true,
            reason: leaveRequest.reason || '',
          },
        },
        { upsert: true, setDefaultsOnInsert: true, returnDocument: 'after' }
      )
    )
  );
};

module.exports = {
  eachDayInclusive,
  syncApprovedLeaveToAttendance,
};
