const axios = require('axios');
const { ContentArticle, PipelineRun } = require('../models');
const { publishArticle } = require('./knowledgeEngineService');
const { generateArticleSchema } = require('./schemaGeneratorService');
const { getOrCreateSettings } = require('./knowledgeEngineService');
const { prepareMediumPackage } = require('./mediumPrepService');
const { createDistributionJobs } = require('./socialRepurposeService');

async function triggerWebsiteRevalidate(slug) {
  const secret = process.env.KNOWLEDGE_REVALIDATE_SECRET;
  const url = process.env.TSC_WEBSITE_REVALIDATE_URL || process.env.VERCEL_REVALIDATE_URL;
  if (!secret || !url) return { skipped: true };
  try {
    await axios.post(url, { secret, slug, paths: [`/insights/${slug}`, '/resources'] }, { timeout: 15000 });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function pingIndexNow(urls) {
  const key = process.env.INDEXNOW_KEY;
  if (!key || !urls?.length) return { skipped: true };
  try {
    await axios.post('https://api.indexnow.org/indexnow', {
      host: 'theshakticollective.in',
      key,
      urlList: urls,
    }, { timeout: 15000 });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function publishArticleFlow(articleId, userId) {
  const run = await PipelineRun.create({ jobType: 'publish-website', status: 'running', input: { articleId } });
  try {
    const settings = await getOrCreateSettings();
    const article = await publishArticle(articleId, userId);
    const full = await ContentArticle.findById(articleId);
    full.schemaJsonLd = generateArticleSchema(full.toObject(), settings);
    await full.save();

    const revalidate = await triggerWebsiteRevalidate(full.slug);
    const indexNow = await pingIndexNow([full.canonicalUrl]);

    const medium = await prepareMediumPackage(full._id);
    const distribution = await createDistributionJobs(full._id);

    run.status = 'completed';
    run.output = { articleId: String(full._id), revalidate, indexNow, medium, distribution };
    run.completedAt = new Date();
    await run.save();
    return full.toObject();
  } catch (err) {
    run.status = 'failed';
    run.error = err.message;
    run.completedAt = new Date();
    await run.save();
    throw err;
  }
}

async function generateArticleImages(articleId) {
  const run = await PipelineRun.create({ jobType: 'article-images', status: 'running', input: { articleId } });
  try {
    const article = await ContentArticle.findById(articleId);
    if (!article) throw new Error('Article not found');
    const base = process.env.TSC_SITE_BASE_URL || 'https://theshakticollective.in';
    const placeholder = `${base}/assets/Patterns/LogoArtboard%2017@300x-8.png`;
    article.heroImageUrl = article.heroImageUrl || placeholder;
    article.ogImageUrl = article.ogImageUrl || article.heroImageUrl;
    article.images = {
      hero: article.heroImageUrl,
      og: article.ogImageUrl,
      pinterest: article.ogImageUrl,
      twitter: article.ogImageUrl,
    };
    await article.save();
    run.status = 'completed';
    run.output = { articleId: String(article._id) };
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

module.exports = { publishArticleFlow, generateArticleImages, triggerWebsiteRevalidate };
