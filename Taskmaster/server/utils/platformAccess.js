const { isRootAdminUser } = require('../../shared/platformUserIds');
const { isRootAdminEmail } = require('../../shared/rootAdminEmails');

/** Root admins are protected from deletion (PlatformSettings user IDs + legacy email list). */
const isProtectedRootAdmin = (user) => {
  if (!user) return false;
  return isRootAdminUser(user) || isRootAdminEmail(user.email);
};

const getDeleteUserBlockReason = (requester, targetUser) => {
  if (!targetUser) return 'No user selected';

  const requesterId = requester?._id || requester?.id;
  const targetId = targetUser?._id || targetUser?.id;
  if (requesterId && targetId && String(requesterId) === String(targetId)) {
    return 'You cannot delete your own account';
  }

  if (isProtectedRootAdmin(targetUser)) {
    return 'Root admin accounts are protected';
  }

  return null;
};

module.exports = {
  isProtectedRootAdmin,
  getDeleteUserBlockReason,
};
