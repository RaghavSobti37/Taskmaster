const mongoose = require('mongoose');

const MEMBERSHIP_ROLES = ['owner', 'admin', 'member'];
const MEMBERSHIP_STATUSES = ['active', 'invited', 'suspended'];

const tenantMembershipSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, enum: MEMBERSHIP_ROLES, default: 'member', required: true },
  needsRoleReview: { type: Boolean, default: false },
  status: { type: String, enum: MEMBERSHIP_STATUSES, default: 'active' },
  customRoleId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomRole' },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  joinedAt: { type: Date, default: Date.now },
}, { timestamps: true });

tenantMembershipSchema.index({ tenantId: 1, userId: 1 }, { unique: true });
tenantMembershipSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('TenantMembership', tenantMembershipSchema);
module.exports.MEMBERSHIP_ROLES = MEMBERSHIP_ROLES;
module.exports.MEMBERSHIP_STATUSES = MEMBERSHIP_STATUSES;
