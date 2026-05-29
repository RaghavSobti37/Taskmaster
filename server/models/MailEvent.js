const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');


const MailEventSchema = new mongoose.Schema({
  messageId: { type: String, index: true },
  eventType: { type: String, required: true },
  email: { type: String, index: true },
  timestamp: { type: Date, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed },
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'MailCampaign', index: true },
  senderProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailProfile', index: true },
  rotationProvider: { type: String, index: true },
  linkClicked: { type: String },
  ipAddress: { type: String },
  userAgent: { type: String },
  location: {
    country: { type: String },
    city: { type: String }
  }
}, { timestamps: true });

MailEventSchema.index({ 'location.country': 1, 'location.city': 1 });

MailEventSchema.plugin(tenantPlugin);

module.exports = mongoose.model('MailEvent', MailEventSchema);
