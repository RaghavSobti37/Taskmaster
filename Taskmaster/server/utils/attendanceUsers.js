const {
  isAttendanceExcluded: isAttendanceExcludedByPattern,
  ATTENDANCE_LEGACY_NAME_PATTERN: ATTENDANCE_EXCLUDED_PATTERN,
} = require('../../shared/attendanceExcludedUsers');
const {
  isAttendanceExcludedByUserId,
  isQaExcludedUser,
} = require('../../shared/platformUserIds');

const isAttendanceExcluded = (user) =>
  isAttendanceExcludedByPattern(user)
  || isAttendanceExcludedByUserId(user)
  || isQaExcludedUser(user);

module.exports = {
  ATTENDANCE_EXCLUDED_PATTERN,
  isAttendanceExcluded,
};
