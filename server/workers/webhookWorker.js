const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const logger = require('../utils/logger');
const { processBookedCallLogic } = require('../controllers/webhookController');

const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 50, 2000)
});

const initWebhookWorker = () => {
  const worker = new Worker('WebhookQueue', async job => {
    logger.info('webhookWorker', `Processing job ${job.id} of type ${job.name}`);
    if (job.name === 'book-call') {
      await processBookedCallLogic(job.data);
    }
  }, { connection });

  worker.on('completed', job => {
    logger.info('webhookWorker', `Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    logger.error('webhookWorker', `Job ${job.id} failed`, { error: err.message });
  });
  
  logger.info('webhookWorker', 'Webhook BullMQ worker initialized');
};

module.exports = { initWebhookWorker };
