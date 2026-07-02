const axios = require('axios');
const { ContentArticle } = require('../models');
const { buildCanonicalUrl } = require('../utils/contentHelpers');
const { getOrCreateSettings } = require('./knowledgeEngineService');

async function sendNotification({ subject, body }) {
  const settings = await getOrCreateSettings();
  const results = [];
  if (settings.notifySlackWebhook) {
    try {
      await axios.post(settings.notifySlackWebhook, { text: `${subject}\n${body}` }, { timeout: 10000 });
      results.push({ channel: 'slack', ok: true });
    } catch (err) {
      results.push({ channel: 'slack', ok: false, error: err.message });
    }
  }
  return results;
}

async function prepareMediumPackage(articleId) {
  const article = await ContentArticle.findById(articleId);
  if (!article) throw new Error('Article not found');
  const canonicalUrl = article.canonicalUrl || buildCanonicalUrl(article.slug);
  const intro = `Originally published on [The Shakti Collective](${canonicalUrl}) →`;
  const pkg = {
    canonicalUrl,
    importUrl: 'https://medium.com/p/import',
    introLine: intro,
    title: article.title,
    markdown: `${intro}\n\n${article.bodyMarkdown}`,
    instructions: [
      '1. Open https://medium.com/p/import',
      '2. Paste the canonical URL (Medium sets canonical automatically)',
      '3. Add the intro line linking back to TSC',
      '4. Publish and paste the Medium URL back in CoreKnot',
    ],
  };
  article.mediumPrepPackage = pkg;
  await article.save();
  await sendNotification({
    subject: `Medium import ready: ${article.title}`,
    body: `Canonical: ${canonicalUrl}\nImport: https://medium.com/p/import`,
  });
  return pkg;
}

async function recordMediumUrl(articleId, mediumUrl) {
  const article = await ContentArticle.findById(articleId);
  if (!article) throw new Error('Article not found');
  article.mediumUrl = mediumUrl;
  await article.save();
  return article.toObject();
}

module.exports = { prepareMediumPackage, recordMediumUrl, sendNotification };
