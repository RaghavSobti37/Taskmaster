/** Platform owner emails — never deletable via admin UI or API. */
const DEFAULT_ROOT_ADMIN_EMAILS = [
  'test@example.com',
  'REDACTED_ADMIN@example.com',
  'redacted@example.com',
  'redacted@example.com',
];

const parseRootAdminEmails = () => {
  const raw = (process.env.ROOT_ADMIN_EMAILS || '').trim();
  const values = raw
    ? raw.split(',').map((v) => v.trim()).filter(Boolean)
    : DEFAULT_ROOT_ADMIN_EMAILS;
  return new Set(values.map((v) => v.toLowerCase()));
};

const ROOT_ADMIN_EMAILS = parseRootAdminEmails();

const isRootAdminEmail = (email) => ROOT_ADMIN_EMAILS.has(String(email || '').toLowerCase().trim());

/** Returns a user-facing block reason, or null if delete is allowed (server still enforces last-admin rule). */
const getDeleteUserBlockReason = (requester, targetUser) => {
  if (!targetUser) return 'No user selected';

  const requesterId = requester?._id || requester?.id;
  const targetId = targetUser?._id || targetUser?.id;
  if (requesterId && targetId && String(requesterId) === String(targetId)) {
    return 'You cannot delete your own account';
  }

  if (isRootAdminEmail(targetUser.email)) {
    return 'Root admin accounts are protected';
  }

  return null;
};

module.exports = {
  ROOT_ADMIN_EMAILS,
  isRootAdminEmail,
  getDeleteUserBlockReason,
};
