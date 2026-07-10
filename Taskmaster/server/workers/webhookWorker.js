const { Worker } = require('bullmq');
const { createRedisClient, ensureRedisReady, isRedisReady } = require('../utils/wslRedis');
const logger = require('../utils/logger');
const { runWithDefaultWebhookTenant } = require('../utils/webhookTenantContext');
const { processBookedCallLogic, processArtistEnquiryLogic, processArtistPathLogic, processNewsletterLogic, processMasterclassReviewLogic } = require('../controllers/webhookController');

const connection = createRedisClient();

let workerInstance = null;
let workerStartPromise = null;

const initWebhookWorker = () => {
  if (workerInstance) return workerInstance;
  if (!isRedisReady(connection)) {
    if (!workerStartPromise) {
      workerStartPromise = ensureRedisReady(connection).then((ready) => {
        workerStartPromise = null;
        return ready ? initWebhookWorker() : null;
      });
    }
    logger.debug('webhookWorker', 'Deferred - Redis not ready');
    return null;
  }

  workerInstance = new Worker('WebhookQueue', async job => {
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

  workerInstance.on('completed', job => {
    logger.info('webhookWorker', `Job ${job.id} completed successfully`);
  });

  workerInstance.on('failed', (job, err) => {
    logger.error('webhookWorker', `Job ${job.id} failed`, { error: err.message });
  });
  workerInstance.on('error', () => {});
  
  logger.debug('webhookWorker', 'Webhook BullMQ worker initialized');
  return workerInstance;
};

module.exports = { initWebhookWorker };
