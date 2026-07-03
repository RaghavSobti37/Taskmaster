const { DistributionJob, ContentArticle } = require('../models');
const { chatCompletion } = require('./aiClient');

const PLATFORMS = [
  'linkedin', 'instagram', 'facebook', 'threads', 'twitter', 'pinterest',
  'newsletter', 'whatsapp', 'youtube_community', 'reel_script', 'short_script', 'email',
];

async function createDistributionJobs(articleId) {
  const article = await ContentArticle.findById(articleId).lean();
  if (!article) throw new Error('Article not found');

  const llm = await chatCompletion({
    system: 'Return JSON only: { "variants": { "linkedin": "", "instagram": "", "twitter": "", "newsletter": "" } }',
    user: `Repurpose this article for social:\nTitle: ${article.title}\nExcerpt: ${article.excerpt}\n\nBody preview:\n${String(article.bodyMarkdown).slice(0, 2000)}`,
    maxTokens: 2000,
  });

  let variants = {};
  if (llm.ok) {
    try {
      const parsed = JSON.parse(llm.text.replace(/```json|```/g, '').trim());
      variants = parsed.variants || {};
    } catch {
      variants = {};
    }
  }

  const jobs = [];
  for (const platform of PLATFORMS) {
    const content = variants[platform] || defaultVariant(platform, article);
    const job = await DistributionJob.findOneAndUpdate(
      { articleId, platform },
      { articleId, platform, content, status: 'ready' },
      { upsert: true, new: true },
    );
    jobs.push(job);
  }
  return jobs.map((j) => j.toObject());
}

function defaultVariant(platform, article) {
  const base = `${article.title}\n\n${article.excerpt}\n\nRead more: ${article.canonicalUrl || ''}`;
  if (platform === 'twitter') return base.slice(0, 260);
  if (platform === 'instagram') return `${article.excerpt}\n\n#music #artists #TSC #indiemusic`;
  if (platform === 'reel_script' || platform === 'short_script') {
    return `Hook: ${article.title}\nBody: ${article.excerpt}\nCTA: Link in bio → TSC`;
  }
  return base;
}

module.exports = { createDistributionJobs, PLATFORMS };
