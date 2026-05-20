const mongoose = require('mongoose');

const mailCampaignSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subject: { type: String, required: true },
  content: { type: String, required: true },
  senderProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailProfile' },
  status: { type: String, enum: ['Draft', 'Sending', 'Completed', 'Failed'], default: 'Draft' },
  recipients: [{
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    email: String,
    status: { type: String, enum: ['Pending', 'Sent', 'Failed', 'Opened', 'Clicked', 'Bounced', 'Unsubscribed', 'Invalid'], default: 'Pending' },
    sentAt: Date,
    error: String,
    messageId: String // SES Message ID
  }],
  stats: {
    total: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    opened: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 },
    bounced: { type: Number, default: 0 },
    unsubscribed: { type: Number, default: 0 },
    invalid: { type: Number, default: 0 }
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

mailCampaignSchema.index({ 'recipients.messageId': 1 });
mailCampaignSchema.index({ 'recipients.email': 1 });

module.exports = mongoose.model('MailCampaign', mailCampaignSchema);
