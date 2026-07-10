/** Client ESM mirror of shared/attendanceExcludedUsers.js — keep in sync */

const ATTENDANCE_EXCLUDED_EMAILS = Object.freeze([
  'redacted@example.com',
]);

const ATTENDANCE_EXCLUDED_EMAIL_SET = new Set(
  ATTENDANCE_EXCLUDED_EMAILS.map((e) => String(e).trim().toLowerCase())
);

export const ATTENDANCE_EXCLUDED_PATTERN = /(test\s*user|qa\s*tester|^test$|demo\s*user|sandesh|test\s*admin|qa\s*autonomous\s*engineer|\[E2E\]|^E2E\s)/i;

const ATTENDANCE_EXCLUDED_NAME_PATTERN = /\brohith\b/i;

const ATTENDANCE_EXCLUDED_EMAIL_PATTERNS = [
  /^e2e-.+@test\.coreknot\.local$/i,
  /@test\.coreknot\.local$/i,
  /^test@example\.com$/i,
  /^test-bounce@example\.com$/i,
  /^qa-/i,
  /^qa@/i,
  /^exly-test-/i,
  /^artist\.enquiry\.test@/i,
  /^workflow_test/i,
];

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const isExcludedEmail = (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  if (ATTENDANCE_EXCLUDED_EMAIL_SET.has(normalized)) return true;
  return ATTENDANCE_EXCLUDED_EMAIL_PATTERNS.some((re) => re.test(normalized));
};

export const isAttendanceExcluded = (user) => {
  if (!user) return true;
  const email = normalizeEmail(user.email);
  if (isExcludedEmail(email)) return true;
  const label = `${user.name || ''} ${user.email || ''} ${user.username || ''}`.trim();
  if (ATTENDANCE_EXCLUDED_PATTERN.test(label)) return true;
  if (ATTENDANCE_EXCLUDED_NAME_PATTERN.test(label)) return true;
  return false;
};
