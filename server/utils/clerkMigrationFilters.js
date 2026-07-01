const { isE2eTestUser } = require('./e2eTestUsers');

/** Emails that must never be created in Clerk or added to the org. */
const CLERK_MIGRATION_EXCLUDED_PATTERNS = [
  /^e2e-.+@test\.coreknot\.local$/i,
  /@test\.coreknot\.local$/i,
  /@coreknot-test\.local$/i,
  /^test-bounce@example\.com$/i,
  /^test@example\.com$/i,
  /^exly-test-/i,
  /^qa-/i,
  /^artist\.enquiry\.test@/i,
  /^workflow_test/i,
  /^webhook\.smoke@/i,
  /^artist-booking-live-/i,
  /^admin-roles-\d+@coreknot-test\.local$/i,
  /^system-health-\d+@coreknot-test\.local$/i,
  /^patch-project-\d+@test\.coreknot\.local$/i,
  /@example\.com$/i,
];

const isClerkMigrationExcludedEmail = (email) => {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return true;
  if (isE2eTestUser(normalized)) return true;
  return CLERK_MIGRATION_EXCLUDED_PATTERNS.some((re) => re.test(normalized));
};

const staffAllowedDomain = () =>
  String(process.env.ALLOWED_DOMAIN || 'theshakticollective.in').trim().toLowerCase();

const isStaffEmail = (email, allowedDomain = staffAllowedDomain()) => {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || isClerkMigrationExcludedEmail(normalized)) return false;
  const admin = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (admin && normalized === admin) return true;
  const domain = String(allowedDomain || '').trim().toLowerCase();
  if (!domain) return false;
  return normalized.endsWith(`@${domain}`);
};

module.exports = {
  CLERK_MIGRATION_EXCLUDED_PATTERNS,
  isClerkMigrationExcludedEmail,
  isStaffEmail,
  staffAllowedDomain,
};
