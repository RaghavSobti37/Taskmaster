const mongoose = require('mongoose');

const platformSettingsSchema = new mongoose.Schema(
  {
    singletonKey: { type: String, default: 'global', unique: true, immutable: true },
    rootAdminUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    platformOwnerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    attendanceExcludedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    qaExcludedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    mailTemplateApproverUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    autoProjectMemberUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    qaAdminUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    backupNotifyUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    subscriptionReminderFallbackUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    passwordResetCcUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    primaryCallAssigneeUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    bookedCallSalesRepUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    /** Atomic counter for website book-a-call round-robin when Redis unavailable */
    bookedCallRoundRobinCounter: { type: Number, default: 0 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);
