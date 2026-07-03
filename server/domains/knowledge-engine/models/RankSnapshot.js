const mongoose = require('mongoose');
const tenantPlugin = require('../../../plugins/tenantPlugin');

const rankSnapshotSchema = new mongoose.Schema(
  {
    articleId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContentArticle', index: true },
    keyword: { type: String, required: true, trim: true, index: true },
    position: { type: Number },
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    ctr: { type: Number, default: 0 },
    snapshotDate: { type: Date, required: true, index: true },
    source: { type: String, default: 'gsc' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

rankSnapshotSchema.plugin(tenantPlugin);

module.exports = mongoose.model('RankSnapshot', rankSnapshotSchema);
