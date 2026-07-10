const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const whatsappCampaignRegistrySchema = new mongoose.Schema({
  campaignName: { type: String, required: true, index: true },
  channel: { type: String, enum: ['whatsapp'], default: 'whatsapp' },
  tags: [{ type: String }],
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

whatsappCampaignRegistrySchema.index({ tenantId: 1, campaignName: 1 }, { unique: true });
whatsappCampaignRegistrySchema.plugin(tenantPlugin);

module.exports = mongoose.model('WhatsappCampaignRegistry', whatsappCampaignRegistrySchema);
