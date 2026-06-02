/** Platform owner emails — never deletable via admin UI or API. */
const ROOT_ADMIN_EMAILS = new Set([
  'test@example.com',
  'REDACTED_ADMIN@example.com',
  'redacted@example.com',
]);

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
