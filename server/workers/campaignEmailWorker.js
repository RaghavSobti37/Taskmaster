const { Worker } = require('bullmq');
const logger = require('../utils/logger');
const { runWithWorkerTenant } = require('../utils/workerTenantContext');
const { maxPerSecond } = require('../utils/resendSendGate');
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

  const rateLimit = maxPerSecond();
  // ponytail: concurrency > rate limit causes Resend 429 bursts across parallel jobs
  const configuredConcurrency = Math.max(1, parseInt(process.env.CAMPAIGN_EMAIL_CONCURRENCY || '1', 10));
  const concurrency = Math.min(configuredConcurrency, rateLimit);
  const limiterDurationMs = Math.ceil(1000 / rateLimit);

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
      limiter: { max: 1, duration: limiterDurationMs },
    },
  );

  worker.on('failed', (job, err) => {
    logger.error('campaignEmailWorker', `Job ${job?.id} failed`, {
      email: job?.data?.email,
      campaignId: job?.data?.campaignId,
      attemptsMade: job?.attemptsMade,
      error: err.message,
    });
  });

  worker.on('error', () => {});

  logger.info(
    'campaignEmailWorker',
    `Started (concurrency=${concurrency}, pacing=1 per ${limiterDurationMs}ms, ~${rateLimit}/s)`,
  );
  return worker;
};

module.exports = { initCampaignEmailWorker };
