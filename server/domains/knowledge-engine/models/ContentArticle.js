const mongoose = require('mongoose');
const tenantPlugin = require('../../../plugins/tenantPlugin');

const CONTENT_STATUSES = ['draft', 'review', 'scheduled', 'published', 'archived'];
const CONTENT_TYPES = [
  'how_to', 'guide', 'case_study', 'artist_story', 'news', 'festival_guide',
  'location_page', 'comparison', 'listicle', 'faq', 'tutorial', 'event_recap',
  'workshop_summary', 'beginner_guide', 'advanced_guide', 'checklist', 'short',
];

const contentArticleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    status: { type: String, default: 'draft', enum: CONTENT_STATUSES, index: true },
    contentType: { type: String, default: 'guide', enum: CONTENT_TYPES },
    excerpt: { type: String, trim: true },
    metaDescription: { type: String, trim: true },
    bodyMarkdown: { type: String, default: '' },
    bodyHtml: { type: String, default: '' },
    authorName: { type: String, default: 'The Shakti Collective' },
    readTimeMinutes: { type: Number, default: 5 },
    keywords: [{ type: String, trim: true }],
    tags: [{ type: String, trim: true }],
    category: { type: String, default: 'insights', trim: true },
    heroImageUrl: { type: String, trim: true },
    ogImageUrl: { type: String, trim: true },
    images: { type: mongoose.Schema.Types.Mixed, default: {} },
    schemaJsonLd: { type: [mongoose.Schema.Types.Mixed], default: [] },
    internalLinks: [{ url: String, anchor: String }],
    externalLinks: [{ url: String, anchor: String }],
    faq: [{ question: String, answer: String }],
    canonicalUrl: { type: String, trim: true },
    mediumUrl: { type: String, trim: true },
    mediumPrepPackage: { type: mongoose.Schema.Types.Mixed, default: null },
    qualityScore: { type: Number, default: 0, min: 0, max: 100 },
    opportunityId: { type: mongoose.Schema.Types.ObjectId, ref: 'ContentOpportunity' },
    briefId: { type: mongoose.Schema.Types.ObjectId, ref: 'SeoBrief' },
    scheduledAt: { type: Date },
    publishedAt: { type: Date, index: true },
    pipelineStage: { type: String, default: 'idle' },
    pipelineMeta: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

contentArticleSchema.index({ slug: 1 }, { unique: true });
contentArticleSchema.index({ title: 'text', excerpt: 'text', bodyMarkdown: 'text' });
contentArticleSchema.plugin(tenantPlugin);

module.exports = mongoose.model('ContentArticle', contentArticleSchema);
module.exports.CONTENT_STATUSES = CONTENT_STATUSES;
module.exports.CONTENT_TYPES = CONTENT_TYPES;
