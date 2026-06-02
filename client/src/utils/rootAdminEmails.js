/** Client mirror of shared/rootAdminEmails.js */
const ROOT_ADMIN_EMAILS = new Set([
  'test@example.com',
  'REDACTED_ADMIN@example.com',
  'redacted@example.com',
]);

export const isRootAdminEmail = (email) =>
  ROOT_ADMIN_EMAILS.has(String(email || '').toLowerCase().trim());
