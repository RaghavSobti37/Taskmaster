const { isMailTemplateApproverUser } = require('../../shared/platformUserIds');
const { isAdminUser } = require('./departmentPermissions');

const canApproveMailTemplates = (user) =>
  isAdminUser(user) || isMailTemplateApproverUser(user);

module.exports = {
  canApproveMailTemplates,
};
