const mongoose = require('mongoose');
const tenantPlugin = require('../../../plugins/tenantPlugin');

const contentOpportunitySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    topic: { type: String, trim: true },
    contentType: { type: String, default: 'guide' },
    keywordClusterId: { type: mongoose.Schema.Types.ObjectId, ref: 'KeywordCluster' },
    primaryKeyword: { type: String, trim: true },
    scores: {
      volume: { type: Number, default: 0 },
      competition: { type: Number, default: 0 },
      authority: { type: Number, default: 0 },
      businessValue: { type: Number, default: 0 },
      trend: { type: Number, default: 0 },
      relevance: { type: Number, default: 0 },
      freshness: { type: Number, default: 0 },
      gap: { type: Number, default: 0 },
      intent: { type: Number, default: 0 },
    },
    overallScore: { type: Number, default: 0, index: true },
    status: { type: String, default: 'candidate', enum: ['candidate', 'approved', 'briefed', 'generated', 'rejected'] },
    sourceSignals: [{ type: String }],
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

contentOpportunitySchema.index({ title: 'text', topic: 'text', primaryKeyword: 'text' });
contentOpportunitySchema.plugin(tenantPlugin);

module.exports = mongoose.model('ContentOpportunity', contentOpportunitySchema);
