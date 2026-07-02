const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const { getRedisUrl } = require('../utils/wslRedis');
const logger = require('../utils/logger');

const QUEUE_NAME = 'knowledge-engine';
let queue = null;
let worker = null;

function getConnection() {
  return new Redis(getRedisUrl(), { maxRetriesPerRequest: null });
}

function initKnowledgeEngineWorker() {
  if (process.env.NODE_ENV === 'test') return null;
  try {
    const connection = getConnection();
    queue = new Queue(QUEUE_NAME, { connection });

    worker = new Worker(QUEUE_NAME, async (job) => {
      const ingestionService = require('../domains/knowledge-engine/services/ingestionService');
      const keywordPipelineService = require('../domains/knowledge-engine/services/keywordPipelineService');
      const { captureRankSnapshots } = require('../domains/knowledge-engine/services/rankTrackingService');
      const { runWeeklySelfImprovement } = require('../domains/knowledge-engine/services/selfImprovementService');
      const { runArticlePipeline } = require('../domains/knowledge-engine/services/articlePipelineService');
      const { publishArticleFlow } = require('../domains/knowledge-engine/services/publishService');

      switch (job.name) {
        case 'daily-pipeline':
          await ingestionService.runFullIngest();
          await ingestionService.extractOpportunitySignals();
          await keywordPipelineService.discoverKeywords();
          await keywordPipelineService.scoreAllOpportunities();
          await captureRankSnapshots();
          return { ok: true };
        case 'article-pipeline':
          return runArticlePipeline(job.data);
        case 'publish-article':
          return publishArticleFlow(job.data.articleId, job.data.userId);
        case 'self-improve-weekly':
          return runWeeklySelfImprovement();
        default:
          throw new Error(`Unknown knowledge-engine job: ${job.name}`);
      }
    }, { connection, concurrency: 2 });

    worker.on('failed', (job, err) => {
      logger.error('knowledgeEngineWorker', `Job ${job?.name} failed`, { error: err.message });
    });

    logger.debug('knowledgeEngineWorker', 'Initialized');
    return worker;
  } catch (err) {
    logger.warn('knowledgeEngineWorker', 'Init skipped', { error: err.message });
    return null;
  }
}

async function enqueueKnowledgeJob(name, data = {}, opts = {}) {
  if (!queue) return { queued: false, reason: 'queue_unavailable' };
  const job = await queue.add(name, data, { removeOnComplete: true, removeOnFail: 50, ...opts });
  return { queued: true, jobId: job.id };
}

module.exports = { initKnowledgeEngineWorker, enqueueKnowledgeJob, QUEUE_NAME };
