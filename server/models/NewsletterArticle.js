const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');
const { CATEGORY_KEYS } = require('../constants/newsletterCategories');

const NewsletterArticleSchema = new mongoose.Schema({
  issueId: { type: mongoose.Schema.Types.ObjectId, ref: 'NewsletterIssue', required: true, index: true },
  url: { type: String, required: true },
  canonicalUrl: { type: String, index: true },
  category: { type: String, enum: CATEGORY_KEYS, default: 'other', index: true },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  siteName: { type: String, default: '' },
  fetchStatus: {
    type: String,
    enum: ['pending', 'success', 'failed', 'manual'],
    default: 'pending',
  },
  sortOrder: { type: Number, default: 0, index: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  notes: { type: String, default: '' },
  included: { type: Boolean, default: true, index: true },
}, { timestamps: true });

NewsletterArticleSchema.index({ issueId: 1, canonicalUrl: 1 }, { unique: true, sparse: true });

NewsletterArticleSchema.plugin(tenantPlugin);

module.exports = mongoose.model('NewsletterArticle', NewsletterArticleSchema);
