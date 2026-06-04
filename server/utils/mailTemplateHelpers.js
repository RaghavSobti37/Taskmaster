const MailTemplate = require('../models/MailTemplate');
const User = require('../models/User');
const Department = require('../models/Department');
const { createNotification } = require('../services/notificationDispatcher');
const { isAdminUser } = require('./departmentPermissions');
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
  const filter = adminDept ? { departmentId: adminDept._id } : {};
  const admins = await User.find(filter).select('_id name').lean();
  const submitterId = String(submitter._id || submitter);
  await Promise.all(
    admins
      .filter((a) => String(a._id) !== submitterId)
      .map((admin) =>
        createNotification({
          recipientId: admin._id,
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
    if (!isAdminUser(user)) {
      return { ok: false, error: 'Only admins can edit templates pending approval' };
    }
    return { ok: true };
  }
  if (['draft', 'rejected'].includes(template.status)) {
    if (!isOwner && !isAdminUser(user)) {
      return { ok: false, error: 'Not authorized to edit this template' };
    }
    return { ok: true };
  }
  if (template.status === 'approved' && isAdminUser(user)) return { ok: true };
  return { ok: false, error: 'Approved templates cannot be edited' };
};

module.exports = {
  migrateLegacyTemplates,
  mapToObject,
  notifyAdminsTemplateSubmitted,
  assertCanEditTemplate,
  getEffectiveTemplateContent,
};
