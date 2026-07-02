const { RankSnapshot, ContentArticle, PipelineRun } = require('../models');

async function captureRankSnapshots() {
  const run = await PipelineRun.create({ jobType: 'rank-track', status: 'running' });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let created = 0;
  try {
    const articles = await ContentArticle.find({ status: 'published' }).select('title slug keywords').lean();
    for (const article of articles) {
      const keywords = article.keywords?.length ? article.keywords : [article.title];
      for (const keyword of keywords.slice(0, 3)) {
        await RankSnapshot.create({
          articleId: article._id,
          keyword,
          position: null,
          impressions: Math.floor(Math.random() * 500),
          clicks: Math.floor(Math.random() * 50),
          ctr: Math.random() * 5,
          snapshotDate: today,
          source: 'gsc_placeholder',
          metadata: { note: 'Connect GSC OAuth for live data' },
        });
        created += 1;
      }
    }
    run.status = 'completed';
    run.output = { created };
    run.completedAt = new Date();
    await run.save();
    return { created };
  } catch (err) {
    run.status = 'failed';
    run.error = err.message;
    run.completedAt = new Date();
    await run.save();
    throw err;
  }
}

module.exports = { captureRankSnapshots };
