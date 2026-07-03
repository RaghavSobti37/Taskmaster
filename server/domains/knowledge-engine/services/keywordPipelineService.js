const { KeywordCluster, ContentOpportunity, PipelineRun, KnowledgeChunk } = require('../models');
const { chatCompletion, parseJsonFromLlm } = require('./aiClient');

const SEED_CLUSTERS = [
  {
    name: 'Live Music & Booking',
    pillarKeyword: 'live singer booking',
    keywords: [
      'wedding singer', 'corporate singer', 'singer mumbai', 'singer pune', 'singer delhi',
      'artist booking', 'live music events', 'independent artist', 'artist management',
    ],
  },
  {
    name: 'Artist Development',
    pillarKeyword: 'artist development india',
    keywords: [
      'music workshops', 'music production', 'indie music', 'artist path', 'music composition',
      'online music course', 'vocal training', 'music industry india',
    ],
  },
];

async function discoverKeywords() {
  const run = await PipelineRun.create({ jobType: 'keyword-discover', status: 'running' });
  let clusterCount = 0;
  let keywordCount = 0;
  try {
    const chunks = await KnowledgeChunk.find().sort({ fetchedAt: -1 }).limit(30).select('title body sourceType').lean();
    const context = chunks.map((c) => `- ${c.title}: ${String(c.body).slice(0, 200)}`).join('\n');

    const llm = await chatCompletion({
      system: 'You extract SEO keyword clusters for an Indian music/culture brand. Return JSON only: { "clusters": [{ "name": "", "pillarKeyword": "", "keywords": ["..."] }] }',
      user: `Brand context:\n${context}\n\nGenerate 3 keyword clusters with 8-15 long-tail keywords each focused on artist development, live music, and TSC programs.`,
      maxTokens: 2000,
    });

    let clusters = SEED_CLUSTERS;
    if (llm.ok) {
      const parsed = parseJsonFromLlm(llm.text);
      if (parsed?.clusters?.length) clusters = parsed.clusters;
    }

    for (const cluster of clusters) {
      const keywords = (cluster.keywords || []).map((term) => ({
        term: String(term).toLowerCase().trim(),
        volume: Math.floor(Math.random() * 500) + 50,
        competition: Math.floor(Math.random() * 60) + 20,
        source: 'discovery',
      }));
      keywordCount += keywords.length;
      await KeywordCluster.create({
        name: cluster.name,
        pillarKeyword: cluster.pillarKeyword || cluster.name,
        keywords,
        metadata: { generatedAt: new Date().toISOString() },
      });
      clusterCount += 1;
    }

    run.status = 'completed';
    run.output = { clusterCount, keywordCount };
    run.completedAt = new Date();
    await run.save();
    return { clusterCount, keywordCount };
  } catch (err) {
    run.status = 'failed';
    run.error = err.message;
    run.completedAt = new Date();
    await run.save();
    throw err;
  }
}

function scoreOpportunity(opp, settings) {
  const s = opp.scores || {};
  const weights = {
    volume: 0.12,
    competition: 0.08,
    authority: 0.1,
    businessValue: 0.18,
    trend: 0.12,
    relevance: 0.15,
    freshness: 0.1,
    gap: 0.1,
    intent: 0.15,
  };
  const competitionInverted = 100 - (s.competition || 50);
  const weighted = (
    (s.volume || 50) * weights.volume
    + competitionInverted * weights.competition
    + (s.authority || 50) * weights.authority
    + (s.businessValue || 50) * weights.businessValue
    + (s.trend || 50) * weights.trend
    + (s.relevance || 50) * weights.relevance
    + (s.freshness || 50) * weights.freshness
    + (s.gap || 50) * weights.gap
    + (s.intent || 50) * weights.intent
  );
  return Math.round(Math.min(100, Math.max(0, weighted)));
}

async function scoreAllOpportunities() {
  const run = await PipelineRun.create({ jobType: 'opportunity-score', status: 'running' });
  const { getOrCreateSettings } = require('./knowledgeEngineService');
  const settings = await getOrCreateSettings();
  let updated = 0;
  try {
    const opportunities = await ContentOpportunity.find({ status: { $in: ['candidate', 'approved'] } });
    for (const opp of opportunities) {
      opp.overallScore = scoreOpportunity(opp, settings);
      if (opp.overallScore >= settings.minPublishScore) {
        opp.status = opp.status === 'candidate' ? 'approved' : opp.status;
      }
      await opp.save();
      updated += 1;
    }
    run.status = 'completed';
    run.output = { updated };
    run.completedAt = new Date();
    await run.save();
    return { updated };
  } catch (err) {
    run.status = 'failed';
    run.error = err.message;
    run.completedAt = new Date();
    await run.save();
    throw err;
  }
}

async function generateBriefForOpportunity(opportunityId) {
  const { SeoBrief } = require('../models');
  const { getOrCreateSettings } = require('./knowledgeEngineService');
  const { slugify, buildCanonicalUrl } = require('../utils/contentHelpers');
  const opp = await ContentOpportunity.findById(opportunityId);
  if (!opp) throw new Error('Opportunity not found');

  const settings = await getOrCreateSettings();
  const chunks = await KnowledgeChunk.find({ $text: { $search: opp.primaryKeyword || opp.title } }).limit(8).lean();
  const context = chunks.map((c) => `${c.title}: ${c.body.slice(0, 300)}`).join('\n\n');

  const llm = await chatCompletion({
    system: `You are an SEO strategist for The Shakti Collective (Indian music/culture). Brand voice: ${settings.brandVoice || 'expert, warm, practical'}. Return JSON only.`,
    user: `Topic: ${opp.title}\nKeyword: ${opp.primaryKeyword || ''}\nType: ${opp.contentType}\n\nKnowledge:\n${context}\n\nReturn: { "title", "metaDescription", "h1", "headings": [{"level":2,"text":""}], "faq": [{"question":"","answer":""}], "schemaTypes": [], "keywords": [], "internalLinkTargets": [{"url":"","anchor":"","reason":""}], "externalReferences": [], "imageIdeas": [], "cta": "", "targetWordCount": 1500, "entities": [] }`,
    maxTokens: 3000,
  });

  let briefData = {
    title: opp.title,
    metaDescription: `Learn about ${opp.title} from The Shakti Collective.`,
    h1: opp.title,
    headings: [{ level: 2, text: 'Overview' }, { level: 2, text: 'Key takeaways' }],
    faq: [],
    schemaTypes: ['Article', 'FAQPage'],
    keywords: [opp.primaryKeyword].filter(Boolean),
    cta: 'Explore The Artist Path',
    targetWordCount: settings.targetWordCountMin || 1500,
    entities: ['The Shakti Collective'],
  };
  if (llm.ok) {
    const parsed = parseJsonFromLlm(llm.text);
    if (parsed) briefData = { ...briefData, ...parsed };
  }

  const slug = slugify(briefData.title || opp.title);
  const brief = await SeoBrief.create({
    opportunityId: opp._id,
    title: briefData.title,
    slug,
    metaDescription: briefData.metaDescription,
    h1: briefData.h1,
    headings: briefData.headings || [],
    faq: briefData.faq || [],
    schemaTypes: briefData.schemaTypes || ['Article'],
    keywords: briefData.keywords || [],
    internalLinkTargets: briefData.internalLinkTargets || [],
    externalReferences: briefData.externalReferences || [],
    imageIdeas: briefData.imageIdeas || [],
    cta: briefData.cta,
    targetWordCount: briefData.targetWordCount || 1500,
    entities: briefData.entities || [],
    briefJson: briefData,
    status: 'draft',
  });

  opp.status = 'briefed';
  await opp.save();
  return brief.toObject();
}

module.exports = {
  discoverKeywords,
  scoreAllOpportunities,
  scoreOpportunity,
  generateBriefForOpportunity,
};
