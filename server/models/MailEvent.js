const mongoose = require('mongoose');

const MailEventSchema = new mongoose.Schema({
  messageId: { type: String, index: true },
  eventType: { type: String, required: true },
  email: { type: String, index: true },
  timestamp: { type: Date, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed },
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'MailCampaign' },
  linkClicked: { type: String },
  ipAddress: { type: String },
  userAgent: { type: String },
  location: {
    country: { type: String, default: 'Unknown' },
    city: { type: String, default: 'Unknown' }
  }
}, { timestamps: true });

MailEventSchema.index({ 'location.country': 1, 'location.city': 1 });

module.exports = mongoose.model('MailEvent', MailEventSchema);
