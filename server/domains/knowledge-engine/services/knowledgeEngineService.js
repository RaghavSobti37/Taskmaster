const {
  KnowledgeChunk,
  ContentArticle,
  ContentCalendarEntry,
  ConnectedAccount,
  KnowledgeSource,
  KeywordCluster,
  ContentOpportunity,
  SeoBrief,
  DistributionJob,
  OutreachCampaign,
  RankSnapshot,
  PipelineRun,
  KnowledgeEngineSettings,
} = require('../models');
const { slugify, estimateReadTime, buildCanonicalUrl, toPublicArticle, toPublicListItem } = require('../utils/contentHelpers');

async function getOrCreateSettings() {
  let settings = await KnowledgeEngineSettings.findOne().sort({ createdAt: 1 });
  if (!settings) {
    settings = await KnowledgeEngineSettings.create({});
  }
  return settings;
}

async function listPublishedPosts({ page = 1, limit = 20, category, tag } = {}) {
  const filter = { status: 'published' };
  if (category) filter.category = category;
  if (tag) filter.tags = tag;
  const skip = (Math.max(1, page) - 1) * limit;
  const [items, total] = await Promise.all([
    ContentArticle.find(filter).setOptions({ bypassTenant: true }).sort({ publishedAt: -1 }).skip(skip).limit(limit).lean(),
    ContentArticle.countDocuments(filter).setOptions({ bypassTenant: true }),
  ]);
  return {
    items: items.map(toPublicListItem),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

async function getPublishedPostBySlug(slug) {
  const article = await ContentArticle.findOne({ slug, status: 'published' }).setOptions({ bypassTenant: true }).lean();
  return article ? toPublicArticle(article) : null;
}

async function listArticles(query = {}) {
  const { status, q, page = 1, limit = 25, contentType } = query;
  const filter = {};
  if (status) filter.status = status;
  if (contentType) filter.contentType = contentType;
  if (q) filter.$text = { $search: q };
  const skip = (Math.max(1, page) - 1) * limit;
  const [items, total] = await Promise.all([
    ContentArticle.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    ContentArticle.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

async function getArticle(id) {
  return ContentArticle.findById(id).lean();
}

async function createArticle(payload, userId) {
  const slug = slugify(payload.slug || payload.title);
  const existing = await ContentArticle.findOne({ slug });
  if (existing) {
    const err = new Error('Slug already exists');
    err.statusCode = 409;
    throw err;
  }
  const bodyMarkdown = payload.bodyMarkdown || '';
  return ContentArticle.create({
    ...payload,
    slug,
    bodyMarkdown,
    readTimeMinutes: payload.readTimeMinutes || estimateReadTime(bodyMarkdown),
    createdById: userId,
  });
}

async function updateArticle(id, payload) {
  const article = await ContentArticle.findById(id);
  if (!article) {
    const err = new Error('Article not found');
    err.statusCode = 404;
    throw err;
  }
  const allowed = [
    'title', 'slug', 'status', 'contentType', 'excerpt', 'metaDescription',
    'bodyMarkdown', 'bodyHtml', 'authorName', 'keywords', 'tags', 'category',
    'heroImageUrl', 'ogImageUrl', 'images', 'schemaJsonLd', 'internalLinks',
    'externalLinks', 'faq', 'mediumUrl', 'scheduledAt', 'qualityScore',
  ];
  for (const key of allowed) {
    if (payload[key] !== undefined) article[key] = payload[key];
  }
  if (payload.slug) article.slug = slugify(payload.slug);
  if (payload.bodyMarkdown !== undefined) {
    article.readTimeMinutes = estimateReadTime(payload.bodyMarkdown);
  }
  await article.save();
  return article.toObject();
}

async function approveArticle(id, userId) {
  const article = await ContentArticle.findById(id);
  if (!article) {
    const err = new Error('Article not found');
    err.statusCode = 404;
    throw err;
  }
  article.status = 'review';
  article.approvedById = userId;
  await article.save();
  return article.toObject();
}

async function publishArticle(id, userId) {
  const article = await ContentArticle.findById(id);
  if (!article) {
    const err = new Error('Article not found');
    err.statusCode = 404;
    throw err;
  }
  const settings = await getOrCreateSettings();
  if (settings.requireHumanApproval && article.status !== 'review' && article.status !== 'scheduled') {
    const err = new Error('Article must be in review or scheduled before publish');
    err.statusCode = 400;
    throw err;
  }
  article.status = 'published';
  article.publishedAt = article.publishedAt || new Date();
  article.canonicalUrl = buildCanonicalUrl(article.slug);
  article.approvedById = userId || article.approvedById;
  await article.save();
  return article.toObject();
}

async function searchKnowledge({ q, sourceType, page = 1, limit = 25 } = {}) {
  const filter = {};
  if (sourceType) filter.sourceType = sourceType;
  if (q) filter.$text = { $search: q };
  const skip = (Math.max(1, page) - 1) * limit;
  const [items, total] = await Promise.all([
    KnowledgeChunk.find(filter).sort({ fetchedAt: -1 }).skip(skip).limit(limit).lean(),
    KnowledgeChunk.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

async function listCalendar({ from, to } = {}) {
  const filter = {};
  if (from || to) {
    filter.scheduledDate = {};
    if (from) filter.scheduledDate.$gte = new Date(from);
    if (to) filter.scheduledDate.$lte = new Date(to);
  }
  return ContentCalendarEntry.find(filter).sort({ scheduledDate: 1 }).populate('articleId', 'title slug status').lean();
}

async function upsertCalendarEntry(payload) {
  if (payload._id) {
    return ContentCalendarEntry.findByIdAndUpdate(payload._id, payload, { new: true }).lean();
  }
  const created = await ContentCalendarEntry.create(payload);
  return created.toObject();
}

async function listConnections() {
  return ConnectedAccount.find().sort({ provider: 1 }).lean();
}

async function listSources() {
  return KnowledgeSource.find().sort({ type: 1 }).lean();
}

async function listKeywords({ page = 1, limit = 50 } = {}) {
  const skip = (Math.max(1, page) - 1) * limit;
  const [items, total] = await Promise.all([
    KeywordCluster.find().sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    KeywordCluster.countDocuments(),
  ]);
  return { items, total, page, limit };
}

async function listOpportunities({ minScore = 0, page = 1, limit = 25 } = {}) {
  const filter = { overallScore: { $gte: minScore } };
  const skip = (Math.max(1, page) - 1) * limit;
  const [items, total] = await Promise.all([
    ContentOpportunity.find(filter).sort({ overallScore: -1 }).skip(skip).limit(limit).lean(),
    ContentOpportunity.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

async function listBriefs({ page = 1, limit = 25 } = {}) {
  const skip = (Math.max(1, page) - 1) * limit;
  const [items, total] = await Promise.all([
    SeoBrief.find().sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    SeoBrief.countDocuments(),
  ]);
  return { items, total, page, limit };
}

async function listDistribution(articleId) {
  const filter = articleId ? { articleId } : {};
  return DistributionJob.find(filter).sort({ createdAt: -1 }).limit(100).lean();
}

async function listOutreach() {
  return OutreachCampaign.find().sort({ updatedAt: -1 }).limit(50).lean();
}

async function getDashboardStats() {
  const [
    chunkCount,
    articleCounts,
    pendingReview,
    published,
    opportunities,
    recentRuns,
    connections,
  ] = await Promise.all([
    KnowledgeChunk.countDocuments(),
    ContentArticle.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ContentArticle.countDocuments({ status: 'review' }),
    ContentArticle.countDocuments({ status: 'published' }),
    ContentOpportunity.countDocuments({ overallScore: { $gte: 80 } }),
    PipelineRun.find().sort({ createdAt: -1 }).limit(10).lean(),
    ConnectedAccount.find().lean(),
  ]);
  const byStatus = Object.fromEntries(articleCounts.map((r) => [r._id, r.count]));
  return {
    knowledgeChunks: chunkCount,
    articlesByStatus: byStatus,
    pendingReview,
    published,
    highScoreOpportunities: opportunities,
    recentPipelineRuns: recentRuns,
    connections,
  };
}

async function updateSettings(payload) {
  const settings = await getOrCreateSettings();
  const allowed = [
    'brandVoice', 'bannedPhrases', 'minPublishScore', 'evergreenPerWeek', 'shortsPerWeek',
    'targetWordCountMin', 'targetWordCountMax', 'requireHumanApproval', 'maxArticlesPerDay',
    'siteBaseUrl', 'contentTypePrompts', 'notifyEmail', 'notifySlackWebhook',
  ];
  for (const key of allowed) {
    if (payload[key] !== undefined) settings[key] = payload[key];
  }
  await settings.save();
  return settings.toObject();
}

async function getAnalyticsSummary() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const [snapshots, topArticles] = await Promise.all([
    RankSnapshot.find({ snapshotDate: { $gte: thirtyDaysAgo } }).sort({ snapshotDate: -1 }).limit(200).lean(),
    ContentArticle.find({ status: 'published' }).sort({ publishedAt: -1 }).limit(10).select('title slug qualityScore publishedAt').lean(),
  ]);
  const totalClicks = snapshots.reduce((s, r) => s + (r.clicks || 0), 0);
  const totalImpressions = snapshots.reduce((s, r) => s + (r.impressions || 0), 0);
  return {
    snapshots: snapshots.slice(0, 50),
    totalClicks,
    totalImpressions,
    avgCtr: totalImpressions ? (totalClicks / totalImpressions) * 100 : 0,
    topArticles,
  };
}

module.exports = {
  getOrCreateSettings,
  listPublishedPosts,
  getPublishedPostBySlug,
  listArticles,
  getArticle,
  createArticle,
  updateArticle,
  approveArticle,
  publishArticle,
  searchKnowledge,
  listCalendar,
  upsertCalendarEntry,
  listConnections,
  listSources,
  listKeywords,
  listOpportunities,
  listBriefs,
  listDistribution,
  listOutreach,
  getDashboardStats,
  updateSettings,
  getAnalyticsSummary,
};
