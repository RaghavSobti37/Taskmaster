const cron = require('node-cron');
const logger = require('../utils/logger');
const { enqueueKnowledgeJob } = require('./knowledgeEngineWorker');

function initKnowledgeEngineScheduler() {
  if (process.env.NODE_ENV === 'test') return;
  if (process.env.KNOWLEDGE_ENGINE_CRON === 'false') return;

  cron.schedule('0 0 * * *', async () => {
    try {
      await enqueueKnowledgeJob('daily-pipeline');
      logger.info('knowledgeEngineScheduler', 'Daily pipeline enqueued');
    } catch (err) {
      logger.error('knowledgeEngineScheduler', 'Daily enqueue failed', { error: err.message });
    }
  });

  cron.schedule('0 6 * * 1', async () => {
    try {
      await enqueueKnowledgeJob('self-improve-weekly');
      logger.info('knowledgeEngineScheduler', 'Weekly self-improve enqueued');
    } catch (err) {
      logger.error('knowledgeEngineScheduler', 'Weekly enqueue failed', { error: err.message });
    }
  });

  logger.debug('knowledgeEngineScheduler', 'Cron registered');
}

module.exports = { initKnowledgeEngineScheduler };
