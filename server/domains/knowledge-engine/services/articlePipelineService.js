const { ContentArticle, SeoBrief, KnowledgeChunk, PipelineRun } = require('../models');
const { chatCompletion } = require('./aiClient');
const { getOrCreateSettings } = require('./knowledgeEngineService');
const { slugify, estimateReadTime } = require('../utils/contentHelpers');
const { applyInternalLinks } = require('./internalLinkingService');
const { generateArticleSchema } = require('./schemaGeneratorService');

const INTERNAL_LINK_MAP = [
  { pattern: /artist path/gi, url: '/artist-path', anchor: 'The Artist Path' },
  { pattern: /tsc academy/gi, url: '/tscacademy', anchor: 'TSC Academy' },
  { pattern: /book a call/gi, url: '/book-a-call', anchor: 'book a call' },
  { pattern: /resources/gi, url: '/resources', anchor: 'artist resources' },
];

async function runArticlePipeline({ briefId, opportunityId, userId }) {
  const run = await PipelineRun.create({ jobType: 'article-pipeline', status: 'running', input: { briefId, opportunityId } });
  try {
    const settings = await getOrCreateSettings();
    let brief = briefId ? await SeoBrief.findById(briefId).lean() : null;
    if (!brief && opportunityId) {
      brief = await SeoBrief.findOne({ opportunityId }).sort({ createdAt: -1 }).lean();
    }
    if (!brief) throw new Error('SEO brief required');

    const chunks = await KnowledgeChunk.find().sort({ fetchedAt: -1 }).limit(15).lean();
    const knowledge = chunks.map((c) => `### ${c.title}\n${c.body.slice(0, 600)}`).join('\n\n');

    const stages = ['outline', 'draft', 'expand', 'seo'];
    let markdown = '';
    let stageOutput = {};

    for (const stage of stages) {
      const llm = await chatCompletion({
        system: `You write for The Shakti Collective. Voice: ${settings.brandVoice || 'expert, warm, practical'}. Banned: ${(settings.bannedPhrases || []).join(', ')}. Use markdown. Ground claims in provided knowledge only.`,
        user: `Stage: ${stage}\nTitle: ${brief.title}\nMeta: ${brief.metaDescription}\nHeadings: ${JSON.stringify(brief.headings)}\nTarget words: ${brief.targetWordCount}\n\nKnowledge:\n${knowledge}\n\n${markdown ? `Current draft:\n${markdown}` : 'Start fresh.'}\n\nProduce the ${stage} output as markdown article body.`,
        maxTokens: 4096,
        temperature: stage === 'outline' ? 0.3 : 0.5,
      });
      if (!llm.ok) throw new Error(llm.error || `Pipeline failed at ${stage}`);
      markdown = llm.text;
      stageOutput[stage] = markdown.length;
    }

    markdown = applyInternalLinks(markdown, brief.internalLinkTargets || []);

    const slug = brief.slug || slugify(brief.title);
    const existing = await ContentArticle.findOne({ slug });
    const articlePayload = {
      title: brief.title,
      slug,
      status: 'draft',
      contentType: 'guide',
      excerpt: brief.metaDescription,
      metaDescription: brief.metaDescription,
      bodyMarkdown: markdown,
      keywords: brief.keywords || [],
      faq: brief.faq || [],
      opportunityId: brief.opportunityId,
      briefId: brief._id,
      readTimeMinutes: estimateReadTime(markdown),
      pipelineStage: 'completed',
      pipelineMeta: stageOutput,
      qualityScore: Math.min(95, 70 + Math.floor(markdown.length / 200)),
      createdById: userId,
    };

    let article;
    if (existing) {
      Object.assign(existing, articlePayload);
      await existing.save();
      article = existing;
    } else {
      article = await ContentArticle.create(articlePayload);
    }

    article.schemaJsonLd = generateArticleSchema(article.toObject(), settings);
    await article.save();

    await SeoBrief.findByIdAndUpdate(brief._id, { status: 'used' });

    run.status = 'completed';
    run.output = { articleId: String(article._id), qualityScore: article.qualityScore };
    run.completedAt = new Date();
    await run.save();
    return article.toObject();
  } catch (err) {
    run.status = 'failed';
    run.error = err.message;
    run.completedAt = new Date();
    await run.save();
    throw err;
  }
}

module.exports = { runArticlePipeline, INTERNAL_LINK_MAP };
