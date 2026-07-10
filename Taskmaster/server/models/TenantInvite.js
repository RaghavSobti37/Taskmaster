const mongoose = require('mongoose');

const INVITE_STATUSES = ['pending', 'accepted', 'revoked', 'expired'];

const tenantInviteSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  role: { type: String, enum: ['admin', 'member'], default: 'member' },
  tokenHash: { type: String, required: true, unique: true, index: true },
  expiresAt: { type: Date, required: true },
  status: { type: String, enum: INVITE_STATUSES, default: 'pending' },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

tenantInviteSchema.index({ tenantId: 1, email: 1, status: 1 });

module.exports = mongoose.model('TenantInvite', tenantInviteSchema);
module.exports.INVITE_STATUSES = INVITE_STATUSES;
