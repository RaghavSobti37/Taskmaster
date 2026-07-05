const { Worker } = require('bullmq');
const { createRedisClient } = require('../utils/wslRedis');
const logger = require('../utils/logger');
const { runWithDefaultWebhookTenant } = require('../utils/webhookTenantContext');
const { processBookedCallLogic, processArtistEnquiryLogic, processArtistPathLogic, processNewsletterLogic, processMasterclassReviewLogic } = require('../controllers/webhookController');

const connection = createRedisClient();


const initWebhookWorker = () => {
  const worker = new Worker('WebhookQueue', async job => {
    logger.info('webhookWorker', `Processing job ${job.id} of type ${job.name}`);
    await runWithDefaultWebhookTenant(async () => {
      if (job.name === 'book-call') {
        await processBookedCallLogic(job.data);
      } else if (job.name === 'artist-enquiry') {
        await processArtistEnquiryLogic(job.data);
      } else if (job.name === 'artist-path') {
        await processArtistPathLogic(job.data);
      } else if (job.name === 'newsletter') {
        await processNewsletterLogic(job.data);
      } else if (job.name === 'masterclass-review') {
        await processMasterclassReviewLogic(job.data);
      }
    });
  }, { connection });

  worker.on('completed', job => {
    logger.info('webhookWorker', `Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    logger.error('webhookWorker', `Job ${job.id} failed`, { error: err.message });
  });
  worker.on('error', (err) => {});
  
  logger.debug('webhookWorker', 'Webhook BullMQ worker initialized');
};

module.exports = { initWebhookWorker };
