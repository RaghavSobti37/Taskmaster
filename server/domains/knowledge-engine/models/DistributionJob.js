const mongoose = require('mongoose');
const tenantPlugin = require('../../../plugins/tenantPlugin');

const distributionJobSchema = new mongoose.Schema(
  {
    articleId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContentArticle', required: true, index: true },
    platform: {
      type: String,
      required: true,
      enum: ['linkedin', 'instagram', 'facebook', 'threads', 'twitter', 'pinterest', 'newsletter', 'whatsapp', 'youtube_community', 'reel_script', 'short_script', 'email'],
    },
    status: { type: String, default: 'pending', enum: ['pending', 'ready', 'sent', 'failed', 'skipped'] },
    content: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    sentAt: { type: Date },
    error: { type: String },
  },
  { timestamps: true },
);

distributionJobSchema.plugin(tenantPlugin);

module.exports = mongoose.model('DistributionJob', distributionJobSchema);
