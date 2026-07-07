const { Worker } = require('bullmq');
const logger = require('../utils/logger');
const { ensureRedisReady, isRedisReady } = require('../utils/wslRedis');
const {
  QUEUE_NAME,
  getTenantInviteEmailConnection,
  processTenantInviteEmail,
} = require('../services/tenantInviteEmailQueue');

let workerInstance = null;
let workerStartPromise = null;

/** Register via jobs/registry integration slice - call initTenantInviteEmailWorker() at startup. */
const initTenantInviteEmailWorker = () => {
  if (workerInstance) return workerInstance;

  const connection = getTenantInviteEmailConnection();
  if (!connection) {
    logger.debug('tenantInviteEmailWorker', 'Skipped - Redis/BullMQ not configured');
    return null;
  }

  if (!isRedisReady(connection)) {
    if (!workerStartPromise) {
      workerStartPromise = ensureRedisReady(connection).then((ready) => {
        workerStartPromise = null;
        return ready ? initTenantInviteEmailWorker() : null;
      });
    }
    logger.debug('tenantInviteEmailWorker', 'Deferred - Redis not ready');
    return null;
  }

  workerInstance = new Worker(
    QUEUE_NAME,
    async (job) => processTenantInviteEmail(job.data),
    {
      connection,
      concurrency: Math.max(1, parseInt(process.env.TENANT_INVITE_EMAIL_CONCURRENCY || '2', 10)),
    },
  );

  workerInstance.on('failed', (job, err) => {
    logger.error('tenantInviteEmailWorker', `Job ${job?.id} failed`, {
      email: job?.data?.email,
      inviteId: job?.data?.inviteId,
      attemptsMade: job?.attemptsMade,
      error: err.message,
    });
  });

  workerInstance.on('error', () => {});

  logger.info('tenantInviteEmailWorker', 'Started');
  return workerInstance;
};

module.exports = { initTenantInviteEmailWorker };
