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
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);
