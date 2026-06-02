/** Emails that cannot be deleted via admin user management. */
const ROOT_ADMIN_EMAILS = new Set([
  'test@example.com',
  'REDACTED_ADMIN@example.com',
  'redacted@example.com',
]);

const isRootAdminEmail = (email) => ROOT_ADMIN_EMAILS.has(String(email || '').toLowerCase().trim());

module.exports = {
  ROOT_ADMIN_EMAILS,
  isRootAdminEmail,
};
