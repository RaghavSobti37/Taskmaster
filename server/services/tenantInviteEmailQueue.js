const { Queue } = require('bullmq');
const { createRedisClient, ensureRedisReady, isRedisReady } = require('../utils/wslRedis');
const logger = require('../utils/logger');

const QUEUE_NAME = 'TenantInviteEmailQueue';
const isTestEnv = process.env.NODE_ENV === 'test';

let connection = null;
let queue = null;

if (!isTestEnv) {
  try {
    connection = createRedisClient();
    queue = new Queue(QUEUE_NAME, { connection });
  } catch (err) {
    logger.warn('tenantInviteEmailQueue', 'Failed to init BullMQ queue', { error: err.message });
    connection = null;
    queue = null;
  }
}

const buildTenantInviteJobId = (inviteId) => `tenant-invite__${String(inviteId)}`;

const buildJobOpts = (jobData) => ({
  jobId: buildTenantInviteJobId(jobData.inviteId),
  removeOnComplete: true,
  removeOnFail: 100,
  attempts: 5,
  backoff: { type: 'exponential', delay: 3000 },
});

const processTenantInviteEmail = async (jobData) => {
  const { dispatchEmailPayload } = require('../domains/mail/services/mailDriver');
  const {
    email,
    tenantName,
    inviteToken,
    inviterName,
    role,
  } = jobData;

  const base = (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173').trim();
  const acceptPath = `/invites/${inviteToken}/accept`;
  const inviteUrl = `${base}${acceptPath}`;
  const subject = `Join ${tenantName} on CoreKnot`;
  const html = `
    <p>Hi,</p>
    <p>${inviterName || 'Your team'} invited you to join <strong>${tenantName}</strong> as <strong>${role}</strong>.</p>
    <p><a href="${inviteUrl}">Accept invitation</a></p>
    <p>If you did not expect this email, you can ignore it.</p>
  `;

  await dispatchEmailPayload({
    to: email,
    subject,
    html,
    from: process.env.SYSTEM_VERIFIED_FROM_EMAIL,
  });
};

const isTenantInviteEmailQueueAvailable = () => {
  if (!queue || !connection) return false;
  return isRedisReady(connection);
};

const enqueueTenantInviteEmails = async (jobDataList = []) => {
  if (!jobDataList.length) return { queued: 0, via: 'none' };
  if (queue && connection && !isRedisReady(connection)) {
    await ensureRedisReady(connection);
  }

  if (!isTenantInviteEmailQueueAvailable()) {
    for (const jobData of jobDataList) {
      // ponytail: inline when Redis/BullMQ unavailable (local dev + tests)
      // eslint-disable-next-line no-await-in-loop
      await processTenantInviteEmail(jobData);
    }
    return { queued: jobDataList.length, via: 'inline' };
  }

  const bulk = jobDataList.map((jobData) => ({
    name: 'send',
    data: jobData,
    opts: buildJobOpts(jobData),
  }));

  try {
    await queue.addBulk(bulk);
    return { queued: bulk.length, via: 'bullmq' };
  } catch (err) {
    logger.error('tenantInviteEmailQueue', 'addBulk failed — falling back inline', {
      error: err.message,
      count: bulk.length,
    });
    for (const jobData of jobDataList) {
      // eslint-disable-next-line no-await-in-loop
      await processTenantInviteEmail(jobData);
    }
    return { queued: jobDataList.length, via: 'inline-fallback' };
  }
};

module.exports = {
  QUEUE_NAME,
  buildTenantInviteJobId,
  isTenantInviteEmailQueueAvailable,
  enqueueTenantInviteEmails,
  processTenantInviteEmail,
  getTenantInviteEmailConnection: () => connection,
};
