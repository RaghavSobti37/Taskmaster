/** Client ESM mirror of shared/attendanceExcludedUsers.js — keep in sync */

const ATTENDANCE_EXCLUDED_EMAILS = Object.freeze([
  'redacted@example.com',
]);

const ATTENDANCE_EXCLUDED_EMAIL_SET = new Set(
  ATTENDANCE_EXCLUDED_EMAILS.map((e) => String(e).trim().toLowerCase())
);

export const ATTENDANCE_EXCLUDED_PATTERN = /(test\s*user|qa\s*tester|^test$|demo\s*user|sandesh|test\s*admin|qa\s*autonomous\s*engineer)/i;

const ATTENDANCE_EXCLUDED_NAME_PATTERN = /\brohith\b/i;

const OPS_DEPARTMENT_SLUG = 'operations';

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const getDepartmentSlug = (user) => {
  const dept = user?.departmentId;
  if (!dept || typeof dept !== 'object') return null;
  return dept.slug || null;
};

export const isAttendanceExcluded = (user) => {
  if (!user) return true;
  const email = normalizeEmail(user.email);
  if (ATTENDANCE_EXCLUDED_EMAIL_SET.has(email)) return true;
  if (getDepartmentSlug(user) === OPS_DEPARTMENT_SLUG) return true;
  const label = `${user.name || ''} ${user.email || ''} ${user.username || ''}`.trim();
  if (ATTENDANCE_EXCLUDED_PATTERN.test(label)) return true;
  if (ATTENDANCE_EXCLUDED_NAME_PATTERN.test(label)) return true;
  return false;
};
