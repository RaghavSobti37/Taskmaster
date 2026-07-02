const mongoose = require('mongoose');
const tenantPlugin = require('../../../plugins/tenantPlugin');

const seoBriefSchema = new mongoose.Schema(
  {
    opportunityId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContentOpportunity', index: true },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    metaDescription: { type: String, trim: true },
    h1: { type: String, trim: true },
    headings: [{ level: Number, text: String }],
    faq: [{ question: String, answer: String }],
    schemaTypes: [{ type: String }],
    keywords: [{ type: String }],
    internalLinkTargets: [{ url: String, anchor: String, reason: String }],
    externalReferences: [{ url: String, label: String }],
    imageIdeas: [{ type: String }],
    videoEmbeds: [{ url: String, title: String }],
    cta: { type: String, trim: true },
    targetWordCount: { type: Number, default: 1500 },
    readingLevel: { type: String, default: 'general' },
    entities: [{ type: String }],
    status: { type: String, default: 'draft', enum: ['draft', 'approved', 'used'] },
    briefJson: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

seoBriefSchema.plugin(tenantPlugin);

module.exports = mongoose.model('SeoBrief', seoBriefSchema);
