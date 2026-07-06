const mongoose = require('mongoose');
const tenantPlugin = require('../../../plugins/tenantPlugin');

const webhookDeliveryLogSchema = new mongoose.Schema(
  {
    webhookId: { type: mongoose.Schema.Types.ObjectId, ref: 'TenantWebhook', index: true },
    event: { type: String, required: true, index: true },
    url: { type: String, required: true },
    statusCode: { type: Number, default: 0 },
    success: { type: Boolean, default: false },
    attempt: { type: Number, default: 1 },
    error: { type: String },
    payloadPreview: { type: String },
    durationMs: { type: Number },
  },
  { timestamps: true },
);

webhookDeliveryLogSchema.index({ tenantId: 1, createdAt: -1 });
webhookDeliveryLogSchema.plugin(tenantPlugin);

module.exports = mongoose.model('WebhookDeliveryLog', webhookDeliveryLogSchema);
