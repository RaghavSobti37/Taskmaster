const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const logger = require('../utils/logger');
const { processBookedCallLogic, processArtistEnquiryLogic } = require('../controllers/webhookController');

const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => {
    if (times > 3) return null;
    return Math.min(times * 50, 2000);
  }
});

connection.on('error', () => {});


const initWebhookWorker = () => {
  const worker = new Worker('WebhookQueue', async job => {
    logger.info('webhookWorker', `Processing job ${job.id} of type ${job.name}`);
    if (job.name === 'book-call') {
      await processBookedCallLogic(job.data);
    } else if (job.name === 'artist-enquiry') {
      await processArtistEnquiryLogic(job.data);
    }
  }, { connection });

  worker.on('completed', job => {
    logger.info('webhookWorker', `Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    logger.error('webhookWorker', `Job ${job.id} failed`, { error: err.message });
  });
  worker.on('error', (err) => {});
  
  logger.info('webhookWorker', 'Webhook BullMQ worker initialized');
};

module.exports = { initWebhookWorker };
