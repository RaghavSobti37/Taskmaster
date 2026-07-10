const mongoose = require('mongoose');
const tenantPlugin = require('../../../plugins/tenantPlugin');


const mailCampaignSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subject: { type: String, required: true },
  content: { type: String, required: true },
  senderProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailProfile' },
  attachments: [{
    filename: String,
    content: String,
    contentType: String
  }],
  status: { type: String, enum: ['Draft', 'Sending', 'Stopped', 'Completed', 'Failed'], default: 'Draft' },
  stoppedAt: { type: Date },
  recipients: [{
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    email: String,
    status: { type: String, enum: ['Pending', 'Queued', 'Sent', 'Failed', 'Opened', 'Clicked', 'Bounced', 'Unsubscribed', 'Invalid', 'Cancelled'], default: 'Pending' },
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
  locationBreakdown: {
    type: Map,
    of: { opens: { type: Number, default: 0 }, clicks: { type: Number, default: 0 } }
  },
  removeUnsubscribe: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

mailCampaignSchema.index({ 'recipients.messageId': 1 });
mailCampaignSchema.index({ 'recipients.email': 1 });
mailCampaignSchema.index({ createdBy: 1, createdAt: -1 });

mailCampaignSchema.plugin(tenantPlugin);

module.exports = mongoose.model('MailCampaign', mailCampaignSchema);
