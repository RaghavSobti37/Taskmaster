const {
  isAttendanceExcluded,
  ATTENDANCE_LEGACY_NAME_PATTERN: ATTENDANCE_EXCLUDED_PATTERN,
} = require('../../shared/attendanceExcludedUsers');

module.exports = {
  ATTENDANCE_EXCLUDED_PATTERN,
  isAttendanceExcluded,
};
