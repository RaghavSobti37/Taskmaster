const asyncHandler = require('../middleware/asyncHandler');
const knowledgeEngineService = require('../domains/knowledge-engine/services/knowledgeEngineService');
const ingestionService = require('../domains/knowledge-engine/services/ingestionService');
const keywordPipelineService = require('../domains/knowledge-engine/services/keywordPipelineService');
const { runArticlePipeline } = require('../domains/knowledge-engine/services/articlePipelineService');
const { publishArticleFlow, generateArticleImages } = require('../domains/knowledge-engine/services/publishService');
const { prepareMediumPackage, recordMediumUrl } = require('../domains/knowledge-engine/services/mediumPrepService');
const { createDistributionJobs } = require('../domains/knowledge-engine/services/socialRepurposeService');
const { createOutreachCampaign, approveOutreachSend } = require('../domains/knowledge-engine/services/outreachService');
const { captureRankSnapshots } = require('../domains/knowledge-engine/services/rankTrackingService');
const { runWeeklySelfImprovement } = require('../domains/knowledge-engine/services/selfImprovementService');
const { hasPageAccess } = require('../utils/pagePermissions');

function hasKnowledgeAccess(user) {
  if (!user) return false;
  if (hasPageAccess(user, 'admin_knowledge_engine')) return true;
  if (hasPageAccess(user, 'admin_data')) return true;
  return false;
}

function requireKnowledgeAccess(req, res, next) {
  if (hasKnowledgeAccess(req.user)) return next();
  return res.status(403).json({ error: 'Forbidden' });
}

exports.getDashboard = asyncHandler(async (req, res) => {
  const stats = await knowledgeEngineService.getDashboardStats();
  const settings = await knowledgeEngineService.getOrCreateSettings();
  res.json({ stats, settings });
});

exports.getSettings = asyncHandler(async (req, res) => {
  const settings = await knowledgeEngineService.getOrCreateSettings();
  res.json(settings);
});

exports.updateSettings = asyncHandler(async (req, res) => {
  const settings = await knowledgeEngineService.updateSettings(req.body);
  res.json(settings);
});

exports.listArticles = asyncHandler(async (req, res) => {
  const data = await knowledgeEngineService.listArticles(req.query);
  res.json(data);
});

exports.getArticle = asyncHandler(async (req, res) => {
  const article = await knowledgeEngineService.getArticle(req.params.id);
  if (!article) return res.status(404).json({ error: 'Not found' });
  res.json(article);
});

exports.createArticle = asyncHandler(async (req, res) => {
  const article = await knowledgeEngineService.createArticle(req.body, req.user._id);
  res.status(201).json(article);
});

exports.updateArticle = asyncHandler(async (req, res) => {
  const article = await knowledgeEngineService.updateArticle(req.params.id, req.body);
  res.json(article);
});

exports.approveArticle = asyncHandler(async (req, res) => {
  const article = await knowledgeEngineService.approveArticle(req.params.id, req.user._id);
  res.json(article);
});

exports.publishArticle = asyncHandler(async (req, res) => {
  const article = await publishArticleFlow(req.params.id, req.user._id);
  res.json(article);
});

exports.searchKnowledge = asyncHandler(async (req, res) => {
  const data = await knowledgeEngineService.searchKnowledge(req.query);
  res.json(data);
});

exports.listCalendar = asyncHandler(async (req, res) => {
  const data = await knowledgeEngineService.listCalendar(req.query);
  res.json(data);
});

exports.upsertCalendar = asyncHandler(async (req, res) => {
  const entry = await knowledgeEngineService.upsertCalendarEntry(req.body);
  res.json(entry);
});

exports.listConnections = asyncHandler(async (req, res) => {
  const data = await knowledgeEngineService.listConnections();
  res.json(data);
});

exports.listSources = asyncHandler(async (req, res) => {
  const data = await knowledgeEngineService.listSources();
  res.json(data);
});

exports.listKeywords = asyncHandler(async (req, res) => {
  const data = await knowledgeEngineService.listKeywords(req.query);
  res.json(data);
});

exports.listOpportunities = asyncHandler(async (req, res) => {
  const settings = await knowledgeEngineService.getOrCreateSettings();
  const minScore = req.query.minScore !== undefined ? Number(req.query.minScore) : settings.minPublishScore;
  const data = await knowledgeEngineService.listOpportunities({ ...req.query, minScore });
  res.json(data);
});

exports.listBriefs = asyncHandler(async (req, res) => {
  const data = await knowledgeEngineService.listBriefs(req.query);
  res.json(data);
});

exports.listDistribution = asyncHandler(async (req, res) => {
  const data = await knowledgeEngineService.listDistribution(req.query.articleId);
  res.json(data);
});

exports.listOutreach = asyncHandler(async (req, res) => {
  const data = await knowledgeEngineService.listOutreach();
  res.json(data);
});

exports.getAnalytics = asyncHandler(async (req, res) => {
  const data = await knowledgeEngineService.getAnalyticsSummary();
  res.json(data);
});

exports.triggerJob = asyncHandler(async (req, res) => {
  const { job } = req.body;
  const handlers = {
    'knowledge-ingest': () => ingestionService.runFullIngest(),
    'opportunity-extract': () => ingestionService.extractOpportunitySignals(),
    'keyword-discover': () => keywordPipelineService.discoverKeywords(),
    'opportunity-score': () => keywordPipelineService.scoreAllOpportunities(),
    'rank-track': () => captureRankSnapshots(),
    'self-improve-weekly': () => runWeeklySelfImprovement(),
  };
  const fn = handlers[job];
  if (!fn) return res.status(400).json({ error: 'Unknown job type' });
  const result = await fn();
  res.json({ ok: true, job, result });
});

exports.generateBrief = asyncHandler(async (req, res) => {
  const brief = await keywordPipelineService.generateBriefForOpportunity(req.params.opportunityId);
  res.status(201).json(brief);
});

exports.runArticlePipeline = asyncHandler(async (req, res) => {
  const article = await runArticlePipeline({
    briefId: req.body.briefId,
    opportunityId: req.body.opportunityId,
    userId: req.user._id,
  });
  res.status(201).json(article);
});

exports.generateImages = asyncHandler(async (req, res) => {
  const article = await generateArticleImages(req.params.id);
  res.json(article);
});

exports.prepareMedium = asyncHandler(async (req, res) => {
  const pkg = await prepareMediumPackage(req.params.id);
  res.json(pkg);
});

exports.setMediumUrl = asyncHandler(async (req, res) => {
  const article = await recordMediumUrl(req.params.id, req.body.mediumUrl);
  res.json(article);
});

exports.createDistribution = asyncHandler(async (req, res) => {
  const jobs = await createDistributionJobs(req.params.id);
  res.json(jobs);
});

exports.createOutreach = asyncHandler(async (req, res) => {
  const campaign = await createOutreachCampaign(req.body);
  res.status(201).json(campaign);
});

exports.approveOutreach = asyncHandler(async (req, res) => {
  const campaign = await approveOutreachSend(req.params.id, Number(req.body.prospectIndex));
  res.json(campaign);
});

exports.requireKnowledgeAccess = requireKnowledgeAccess;
exports.hasKnowledgeAccess = hasKnowledgeAccess;
