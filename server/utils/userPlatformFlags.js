const { isRootAdminUser } = require('../../shared/rootAdminEmails');
const { isMailTemplateApproverUser } = require('../../shared/mailTemplateApprovers');
const { isAdminUser } = require('./departmentPermissions');

const attachUserPlatformFlags = (user) => {
  if (!user) return user;
  const base = user.toObject ? user.toObject() : { ...user };
  return {
    ...base,
    isRootAdmin: isRootAdminUser(base),
    canApproveMailTemplates: isAdminUser(base) || isMailTemplateApproverUser(base),
  };
};

module.exports = { attachUserPlatformFlags };
