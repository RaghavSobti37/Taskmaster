import { isAdminUser } from './departmentPermissions';

const APPROVER_EMAILS = new Set(['redacted-staff@example.com']);

export const canApproveMailTemplates = (user, options = {}) => {
  if (!user) return false;
  if (isAdminUser(user)) return true;

  const { mailTemplateApproverUserIds = [] } = options;
  const userId = String(user._id || user.id || '');
  if (mailTemplateApproverUserIds.map(String).includes(userId)) return true;

  return APPROVER_EMAILS.has(String(user.email || '').trim().toLowerCase());
};
