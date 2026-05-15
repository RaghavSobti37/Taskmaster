const mongoose = require('mongoose');

const mailEventSchema = new mongoose.Schema({
  messageId: { type: String, index: true },
  eventType: { type: String, required: true },
  email: { type: String, index: true },
  timestamp: { type: Date, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed },
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'MailCampaign' }
}, { timestamps: true });

module.exports = mongoose.model('MailEvent', mailEventSchema);
