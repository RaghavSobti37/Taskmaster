const { ContentArticle, ContentOpportunity, PipelineRun, RankSnapshot } = require('../models');
const { getOrCreateSettings } = require('./knowledgeEngineService');

async function runWeeklySelfImprovement() {
  const run = await PipelineRun.create({ jobType: 'self-improve-weekly', status: 'running' });
  try {
    const settings = await getOrCreateSettings();
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000);

    const [topSnapshots, staleArticles, lowPerformers] = await Promise.all([
      RankSnapshot.find().sort({ clicks: -1 }).limit(10).lean(),
      ContentArticle.find({ status: 'published', updatedAt: { $lt: sixtyDaysAgo } }).limit(20).lean(),
      ContentArticle.find({ status: 'published', qualityScore: { $lt: 75 } }).limit(10).lean(),
    ]);

    const recommendations = [];

    for (const article of staleArticles) {
      recommendations.push({
        type: 'refresh',
        articleId: String(article._id),
        title: article.title,
        reason: 'Published over 60 days ago — refresh statistics and metadata',
      });
    }

    for (const article of lowPerformers) {
      recommendations.push({
        type: 'rewrite',
        articleId: String(article._id),
        title: article.title,
        reason: `Quality score ${article.qualityScore} below target`,
      });
    }

    if (topSnapshots.length) {
      recommendations.push({
        type: 'insight',
        reason: `Top keyword: "${topSnapshots[0].keyword}" — create more content in this cluster`,
      });
    }

    const failedOpps = await ContentOpportunity.countDocuments({ overallScore: { $lt: settings.minPublishScore } });
    recommendations.push({
      type: 'pipeline',
      reason: `${failedOpps} opportunities below publish threshold (${settings.minPublishScore})`,
    });

    run.status = 'completed';
    run.output = { recommendations };
    run.completedAt = new Date();
    await run.save();
    return { recommendations };
  } catch (err) {
    run.status = 'failed';
    run.error = err.message;
    run.completedAt = new Date();
    await run.save();
    throw err;
  }
}

module.exports = { runWeeklySelfImprovement };
