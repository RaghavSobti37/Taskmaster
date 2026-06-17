const { Worker } = require('bullmq');
const logger = require('../utils/logger');
const { runWithWorkerTenant } = require('../utils/workerTenantContext');
const {
  QUEUE_NAME,
  getCampaignEmailConnection,
} = require('../services/campaignEmailQueue');

const initCampaignEmailWorker = () => {
  const connection = getCampaignEmailConnection();
  if (!connection) {
    logger.debug('campaignEmailWorker', 'Skipped — Redis/BullMQ not configured');
    return null;
  }

  const concurrency = Math.max(1, parseInt(process.env.CAMPAIGN_EMAIL_CONCURRENCY || '5', 10));
  const rateLimit = Math.max(1, parseInt(process.env.CAMPAIGN_EMAIL_RATE_LIMIT || '8', 10));

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { processEmailJob } = require('../domains/mail/services/emailProcessor');
      const tenantId = job.data?.tenantId;
      if (tenantId) {
        await runWithWorkerTenant(tenantId, () => processEmailJob(job.data));
      } else {
        await processEmailJob(job.data);
      }
    },
    {
      connection,
      concurrency,
      limiter: { max: rateLimit, duration: 1000 },
    },
  );

  worker.on('failed', (job, err) => {
    logger.error('campaignEmailWorker', `Job ${job?.id} failed`, {
      email: job?.data?.email,
      campaignId: job?.data?.campaignId,
      error: err.message,
    });
  });

  worker.on('error', () => {});

  logger.info('campaignEmailWorker', `Started (concurrency=${concurrency}, rate=${rateLimit}/s)`);
  return worker;
};

module.exports = { initCampaignEmailWorker };
