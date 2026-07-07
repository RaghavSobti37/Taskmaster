const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const STATUSES = ['sent', 'delivered', 'read', 'clicked', 'replied', 'failed'];

const CampaignChannelOutcomeSchema = new mongoose.Schema({
  personIndexId: { type: mongoose.Schema.Types.ObjectId, ref: 'PersonIndex', index: true },
  campaignName: { type: String, required: true, index: true },
  channel: { type: String, enum: ['whatsapp'], default: 'whatsapp' },
  status: { type: String, enum: STATUSES, required: true, index: true },
  name: { type: String },
  email: { type: String, index: true, sparse: true },
  phone: { type: String, required: true, index: true },
  failureReason: { type: String },
  sentAt: { type: Date },
  sourceFilename: { type: String },
  tags: [{ type: String }],
  messageId: { type: String, sparse: true, index: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

CampaignChannelOutcomeSchema.index({ tenantId: 1, campaignName: 1, phone: 1 }, { unique: true });
CampaignChannelOutcomeSchema.index({ campaignName: 1, status: 1 });

CampaignChannelOutcomeSchema.plugin(tenantPlugin);

module.exports = mongoose.model('CampaignChannelOutcome', CampaignChannelOutcomeSchema);
module.exports.STATUSES = STATUSES;
