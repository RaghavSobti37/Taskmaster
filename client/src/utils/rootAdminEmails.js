/** Client mirror — root admin delete protection (user IDs from API + legacy email list). */

const ROOT_ADMIN_EMAILS = new Set([
  'test@example.com',
  'REDACTED_ADMIN@example.com',
  'redacted@example.com',
]);

export const isRootAdminEmail = (email) =>
  ROOT_ADMIN_EMAILS.has(String(email || '').toLowerCase().trim());

export const isRootAdminUserId = (userId, rootAdminUserIds = []) =>
  rootAdminUserIds.map(String).includes(String(userId || ''));

export const getDeleteUserBlockReason = (requester, targetUser, options = {}) => {
  const { rootAdminUserIds = [] } = options;
  if (!targetUser) return 'No user selected';

  const requesterId = requester?._id || requester?.id;
  const targetId = targetUser?._id || targetUser?.id;
  if (requesterId && targetId && String(requesterId) === String(targetId)) {
    return 'You cannot delete your own account';
  }

  if (isRootAdminUserId(targetId, rootAdminUserIds) || isRootAdminEmail(targetUser.email)) {
    return 'Root admin accounts are protected';
  }

  return null;
};
