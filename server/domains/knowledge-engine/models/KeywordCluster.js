const mongoose = require('mongoose');
const tenantPlugin = require('../../../plugins/tenantPlugin');

const keywordClusterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    pillarKeyword: { type: String, trim: true },
    keywords: [{
      term: { type: String, required: true },
      volume: { type: Number, default: 0 },
      competition: { type: Number, default: 0 },
      source: { type: String, default: 'manual' },
    }],
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    discoveredAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

keywordClusterSchema.index({ name: 'text', pillarKeyword: 'text' });
keywordClusterSchema.plugin(tenantPlugin);

module.exports = mongoose.model('KeywordCluster', keywordClusterSchema);
