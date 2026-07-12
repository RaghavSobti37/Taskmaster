/** Users who may approve/reject email templates (in addition to admin department). */
const MAIL_TEMPLATE_APPROVER_EMAILS = Object.freeze([
  'redacted-staff@example.com',
]);

const MAIL_TEMPLATE_APPROVER_SET = new Set(
  MAIL_TEMPLATE_APPROVER_EMAILS.map((e) => String(e).trim().toLowerCase())
);

const isMailTemplateApproverEmail = (email) =>
  MAIL_TEMPLATE_APPROVER_SET.has(String(email || '').trim().toLowerCase());

module.exports = {
  MAIL_TEMPLATE_APPROVER_EMAILS,
  isMailTemplateApproverEmail,
};
