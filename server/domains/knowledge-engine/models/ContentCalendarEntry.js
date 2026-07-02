const mongoose = require('mongoose');
const tenantPlugin = require('../../../plugins/tenantPlugin');

const contentCalendarEntrySchema = new mongoose.Schema(
  {
    scheduledDate: { type: Date, required: true, index: true },
    slotType: { type: String, default: 'evergreen', enum: ['evergreen', 'short', 'refresh'] },
    contentType: { type: String, default: 'guide' },
    articleId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContentArticle' },
    opportunityId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContentOpportunity' },
    title: { type: String, trim: true },
    status: { type: String, default: 'planned', enum: ['planned', 'in_progress', 'ready', 'published', 'skipped'] },
    notes: { type: String },
  },
  { timestamps: true },
);

contentCalendarEntrySchema.plugin(tenantPlugin);

module.exports = mongoose.model('ContentCalendarEntry', contentCalendarEntrySchema);
