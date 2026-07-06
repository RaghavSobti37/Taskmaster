const { Worker } = require('bullmq');
const logger = require('../utils/logger');
const {
  QUEUE_NAME,
  getTenantInviteEmailConnection,
  processTenantInviteEmail,
} = require('../services/tenantInviteEmailQueue');

/** Register via jobs/registry integration slice — call initTenantInviteEmailWorker() at startup. */
const initTenantInviteEmailWorker = () => {
  const connection = getTenantInviteEmailConnection();
  if (!connection) {
    logger.debug('tenantInviteEmailWorker', 'Skipped — Redis/BullMQ not configured');
    return null;
  }

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => processTenantInviteEmail(job.data),
    {
      connection,
      concurrency: Math.max(1, parseInt(process.env.TENANT_INVITE_EMAIL_CONCURRENCY || '2', 10)),
    },
  );

  worker.on('failed', (job, err) => {
    logger.error('tenantInviteEmailWorker', `Job ${job?.id} failed`, {
      email: job?.data?.email,
      inviteId: job?.data?.inviteId,
      attemptsMade: job?.attemptsMade,
      error: err.message,
    });
  });

  worker.on('error', () => {});

  logger.info('tenantInviteEmailWorker', 'Started');
  return worker;
};

module.exports = { initTenantInviteEmailWorker };
