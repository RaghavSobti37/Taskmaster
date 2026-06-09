/**
 * Staff and departments excluded from the ops attendance matrix and morning check-in prompt.
 * Legacy test/demo accounts remain name-pattern matched; ops dept + listed emails are explicit.
 */
const ATTENDANCE_EXCLUDED_EMAILS = Object.freeze([
  'redacted@example.com',
]);

const ATTENDANCE_EXCLUDED_EMAIL_SET = new Set(
  ATTENDANCE_EXCLUDED_EMAILS.map((e) => String(e).trim().toLowerCase())
);

/** Legacy roster exclusions (v1.7.35) — test/demo/QA automation accounts */
const ATTENDANCE_LEGACY_NAME_PATTERN = /(test\s*user|qa\s*tester|^test$|demo\s*user|sandesh|test\s*admin|qa\s*autonomous\s*engineer)/i;

/** Name fallback when attendance rows only store username (dashboard chart) */
const ATTENDANCE_EXCLUDED_NAME_PATTERN = /\brohith\b/i;

const OPS_DEPARTMENT_SLUG = 'operations';

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const getDepartmentSlug = (user) => {
  const dept = user?.departmentId;
  if (!dept || typeof dept !== 'object') return null;
  return dept.slug || null;
};

const isAttendanceExcluded = (user) => {
  if (!user) return true;
  const email = normalizeEmail(user.email);
  if (ATTENDANCE_EXCLUDED_EMAIL_SET.has(email)) return true;
  if (getDepartmentSlug(user) === OPS_DEPARTMENT_SLUG) return true;
  const label = `${user.name || ''} ${user.email || ''} ${user.username || ''}`.trim();
  if (ATTENDANCE_LEGACY_NAME_PATTERN.test(label)) return true;
  if (ATTENDANCE_EXCLUDED_NAME_PATTERN.test(label)) return true;
  return false;
};

module.exports = {
  ATTENDANCE_EXCLUDED_EMAILS,
  ATTENDANCE_LEGACY_NAME_PATTERN,
  ATTENDANCE_EXCLUDED_NAME_PATTERN,
  OPS_DEPARTMENT_SLUG,
  isAttendanceExcluded,
};
