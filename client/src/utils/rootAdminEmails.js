/** Client mirror of shared/rootAdminEmails.js — keep in sync */

const ROOT_ADMIN_EMAILS = new Set([
  'test@example.com',
  'REDACTED_ADMIN@example.com',
  'redacted@example.com',
]);

export const isRootAdminEmail = (email) =>
  ROOT_ADMIN_EMAILS.has(String(email || '').toLowerCase().trim());

export const getDeleteUserBlockReason = (requester, targetUser) => {
  if (!targetUser) return 'No user selected';

  const requesterId = requester?._id || requester?.id;
  const targetId = targetUser?._id || targetUser?.id;
  if (requesterId && targetId && String(requesterId) === String(targetId)) {
    return 'You cannot delete your own account';
  }

  if (isRootAdminEmail(targetUser.email) && !isRootAdminEmail(requester?.email)) {
    return 'Root admin accounts are protected';
  }

  return null;
};
