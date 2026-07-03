const mongoose = require('mongoose');
const tenantPlugin = require('../../../plugins/tenantPlugin');

const knowledgeChunkSchema = new mongoose.Schema(
  {
    sourceType: { type: String, required: true, index: true },
    sourceId: { type: String, default: '' },
    sourceUrl: { type: String, trim: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    excerpt: { type: String, trim: true },
    entities: [{ type: String, trim: true }],
    embedding: { type: [Number], default: [] },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    fetchedAt: { type: Date, default: Date.now },
    contentHash: { type: String, index: true },
  },
  { timestamps: true },
);

knowledgeChunkSchema.index({ title: 'text', body: 'text', excerpt: 'text' });
knowledgeChunkSchema.index({ sourceType: 1, sourceId: 1 });
knowledgeChunkSchema.plugin(tenantPlugin);

module.exports = mongoose.model('KnowledgeChunk', knowledgeChunkSchema);
