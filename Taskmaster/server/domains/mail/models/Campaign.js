const mongoose = require('mongoose');
const tenantPlugin = require('../../../plugins/tenantPlugin');


const campaignSchema = new mongoose.Schema({
  campaignId: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  subject: { type: String },
  content: { type: String },
  senderProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailProfile' },
  senderMode: {
    type: String,
    enum: ['single', 'pool', 'system_resend', 'system_smtp'],
    default: 'single'
  },
  senderProfileIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'EmailProfile' }],
  systemProvider: { type: String, enum: ['resend', 'env_smtp'] },
  resendFromEmail: { type: String, trim: true, lowercase: true },
  emailStreamSlug: { type: String, trim: true, lowercase: true, index: true },
  includeSignature: { type: Boolean, default: true },
  signature: { type: String, default: '' },
  removeUnsubscribe: { type: Boolean, default: false },
  variableFallbacks: {
    type: Map,
    of: String,
    default: () => new Map(),
  },
  mailTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'MailTemplate' },
  variableMapping: {
    type: Map,
    of: String,
    default: () => new Map(),
  },
  attachments: [{
    filename: String,
    contentType: String,
    storageKey: String,
    storageUrl: String,
  }],
  status: { type: String, enum: ['Draft', 'Queued', 'Sending', 'Stopped', 'Completed', 'Failed'], default: 'Draft' },
  recipientCount: { type: Number, default: 0 },
  stoppedAt: { type: Date },
  eventTag: { type: String, index: true }, // Ties campaign metrics back to events
  sentAt: { type: Date, default: Date.now },
  metrics: {
    totalSent: { type: Number, default: 0 },
    opened: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 },
    bounced: { type: Number, default: 0 }
  },
  timeSeries: [{
    time: { type: Date },
    opens: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 }
  }],
  locationBreakdown: {
    type: Map,
    of: { opens: { type: Number, default: 0 }, clicks: { type: Number, default: 0 } }
  },
  recipients: [{
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    email: String,
    name: String,
    rowData: {
      type: Map,
      of: String,
    },
    status: { type: String, enum: ['Pending', 'Queued', 'Sent', 'Failed', 'Opened', 'Clicked', 'Bounced', 'Unsubscribed', 'Invalid', 'Cancelled'], default: 'Pending' },
    sentAt: Date,
    error: String,
    messageId: String
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

campaignSchema.index({ createdBy: 1 });
campaignSchema.index({ 'recipients.messageId': 1 });
campaignSchema.index({ 'recipients.email': 1 });

campaignSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Campaign', campaignSchema);
