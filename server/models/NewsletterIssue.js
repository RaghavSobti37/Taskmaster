const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const NewsletterIssueSchema = new mongoose.Schema({
  weekKey: { type: String, required: true, unique: true, index: true },
  weekStart: { type: Date, required: true },
  weekEnd: { type: Date, required: true },
  status: {
    type: String,
    enum: ['collecting', 'curating', 'ready', 'sent', 'archived'],
    default: 'collecting',
    index: true,
  },
  introTitle: { type: String, default: 'This Week at the Collective' },
  introBlurb: {
    type: String,
    default: 'Your weekly roundup of stories, tips, and updates from The Shakti Collective.',
  },
  compiledHtml: { type: String },
  compiledAt: { type: Date },
  campaignId: { type: String, index: true },
  sentAt: { type: Date },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

NewsletterIssueSchema.plugin(tenantPlugin);

module.exports = mongoose.model('NewsletterIssue', NewsletterIssueSchema);
