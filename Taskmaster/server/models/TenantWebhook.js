const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const tenantWebhookSchema = new mongoose.Schema({
  url: { type: String, required: true, trim: true },
  events: [{ type: String }],
  secretHash: { type: String, required: true, select: false },
  secretEncrypted: { type: String, select: false },
  secretPrefix: { type: String },
  active: { type: Boolean, default: true },
  lastDeliveryAt: { type: Date },
  lastStatus: { type: Number },
  failureCount: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

tenantWebhookSchema.index({ tenantId: 1, active: 1 });

tenantWebhookSchema.plugin(tenantPlugin);

module.exports = mongoose.model('TenantWebhook', tenantWebhookSchema);
