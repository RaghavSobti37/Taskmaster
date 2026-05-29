const ATTENDANCE_EXCLUDED_PATTERN = /(test\s*user|qa\s*tester|^test$|demo\s*user|sandesh|test\s*admin|qa\s*autonomous\s*engineer)/i;

const isAttendanceExcluded = (user) => {
  if (!user) return true;
  const label = `${user.name || ''} ${user.email || ''}`.trim();
  return ATTENDANCE_EXCLUDED_PATTERN.test(label);
};

module.exports = {
  ATTENDANCE_EXCLUDED_PATTERN,
  isAttendanceExcluded,
};
