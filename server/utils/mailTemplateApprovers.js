const { isMailTemplateApproverEmail } = require('../../shared/mailTemplateApprovers');
const { isAdminUser } = require('./departmentPermissions');

const canApproveMailTemplates = (user) =>
  isAdminUser(user) || isMailTemplateApproverEmail(user?.email);

module.exports = {
  canApproveMailTemplates,
  isMailTemplateApproverEmail,
};
