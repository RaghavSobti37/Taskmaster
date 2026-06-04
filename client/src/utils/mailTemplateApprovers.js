/** Client mirror of shared/mailTemplateApprovers.js — keep in sync */

import { isAdminUser } from './departmentPermissions';

const MAIL_TEMPLATE_APPROVER_EMAILS = [
  'redacted-staff@example.com',
];

const MAIL_TEMPLATE_APPROVER_SET = new Set(
  MAIL_TEMPLATE_APPROVER_EMAILS.map((e) => e.trim().toLowerCase())
);

export const isMailTemplateApproverEmail = (email) =>
  MAIL_TEMPLATE_APPROVER_SET.has(String(email || '').trim().toLowerCase());

/** Admin department or named mail template approvers. */
export const canApproveMailTemplates = (user) =>
  isAdminUser(user) || isMailTemplateApproverEmail(user?.email);
