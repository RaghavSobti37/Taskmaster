const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  campaignId: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  subject: { type: String },
  content: { type: String },
  senderProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailProfile' },
  status: { type: String, enum: ['Draft', 'Queued', 'Sending', 'Completed', 'Failed'], default: 'Draft' },
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
    status: { type: String, enum: ['Pending', 'Queued', 'Sent', 'Failed', 'Opened', 'Clicked', 'Bounced', 'Unsubscribed', 'Invalid'], default: 'Pending' },
    sentAt: Date,
    error: String,
    messageId: String
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Campaign', campaignSchema);
