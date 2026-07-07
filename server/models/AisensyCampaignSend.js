const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const aisensyCampaignSendSchema = new mongoose.Schema({
  campaignName: { type: String, required: true, index: true },
  phone: { type: String, required: true, index: true },
  userName: { type: String },
  tags: [{ type: String }],
  messageId: { type: String, index: true, sparse: true },
  status: { type: String, default: 'sent' },
  sentAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

aisensyCampaignSendSchema.index({ tenantId: 1, phone: 1, sentAt: -1 });
aisensyCampaignSendSchema.index({ tenantId: 1, messageId: 1 }, { unique: true, sparse: true });
aisensyCampaignSendSchema.plugin(tenantPlugin);

module.exports = mongoose.model('AisensyCampaignSend', aisensyCampaignSendSchema);
