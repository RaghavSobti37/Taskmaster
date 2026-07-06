const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const leaveRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  username: { type: String },
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  reason: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending', index: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  reviewNote: { type: String, default: '' },
}, { timestamps: true });

leaveRequestSchema.index({ tenantId: 1, userId: 1, status: 1 });
leaveRequestSchema.plugin(tenantPlugin);

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
