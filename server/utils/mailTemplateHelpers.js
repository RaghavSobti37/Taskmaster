const MailTemplate = require('../models/MailTemplate');
const User = require('../models/User');
const Department = require('../models/Department');
const { createNotification } = require('../services/notificationDispatcher');
const { isAdminUser } = require('./departmentPermissions');
const { canApproveMailTemplates } = require('./mailTemplateApprovers');
const { MAIL_TEMPLATE_APPROVER_EMAILS } = require('../../shared/mailTemplateApprovers');
const { getEffectiveTemplateContent } = require('./indexedTemplateVariables');

const migrateLegacyTemplates = async () => {
  await MailTemplate.updateMany(
    { status: { $exists: false } },
    { $set: { status: 'approved' } }
  );
};

const mapToObject = (mapOrObj) => {
  if (!mapOrObj) return {};
  if (mapOrObj instanceof Map) return Object.fromEntries(mapOrObj.entries());
  return { ...mapOrObj };
};

const notifyAdminsTemplateSubmitted = async (template, submitter) => {
  const adminDept = await Department.findOne({ slug: 'admin' }).lean();
  const adminFilter = adminDept ? { departmentId: adminDept._id } : {};
  const admins = await User.find(adminFilter).select('_id name email').lean();
  const namedApprovers = await User.find({
    email: { $in: MAIL_TEMPLATE_APPROVER_EMAILS.map((e) => e.toLowerCase()) },
  }).select('_id name email').lean();

  const submitterId = String(submitter._id || submitter);
  const recipients = new Map();
  for (const u of [...admins, ...namedApprovers]) {
    if (u?._id && String(u._id) !== submitterId) {
      recipients.set(String(u._id), u);
    }
  }

  await Promise.all(
    [...recipients.values()].map((recipient) =>
      createNotification({
        recipientId: recipient._id,
        title: 'Email template pending approval',
        message: `${submitter.name || 'A user'} submitted "${template.name}" for approval.`,
        category: 'system',
        actionUrl: '/emails',
        actorId: submitter._id,
        sendEmail: false,
      }).catch(() => null)
    )
  );
};

const assertCanEditTemplate = (template, user) => {
  const isOwner = template.createdBy?.toString() === user._id?.toString();
  if (template.status === 'pending_approval') {
    if (!canApproveMailTemplates(user)) {
      return { ok: false, error: 'Only template approvers can edit templates pending approval' };
    }
    return { ok: true };
  }
  if (['draft', 'rejected'].includes(template.status)) {
    if (!isOwner && !isAdminUser(user)) {
      return { ok: false, error: 'Not authorized to edit this template' };
    }
    return { ok: true };
  }
  if (template.status === 'approved' && (isAdminUser(user) || canApproveMailTemplates(user))) {
    return { ok: true };
  }
  return { ok: false, error: 'Approved templates cannot be edited' };
};

module.exports = {
  migrateLegacyTemplates,
  mapToObject,
  notifyAdminsTemplateSubmitted,
  assertCanEditTemplate,
  getEffectiveTemplateContent,
};
