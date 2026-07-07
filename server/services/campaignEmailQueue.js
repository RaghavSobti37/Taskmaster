const { Queue } = require('bullmq');
const { createRedisClient, ensureRedisReady, isRedisReady } = require('../utils/wslRedis');
const logger = require('../utils/logger');

const QUEUE_NAME = 'CampaignEmailQueue';
const isTestEnv = process.env.NODE_ENV === 'test';

let connection = null;
let queue = null;

if (!isTestEnv) {
  try {
    connection = createRedisClient();
    queue = new Queue(QUEUE_NAME, { connection });
  } catch (err) {
    logger.warn('campaignEmailQueue', 'Failed to init BullMQ queue', { error: err.message });
    connection = null;
    queue = null;
  }
}

const isCampaignEmailQueueAvailable = () => {
  if (!queue || !connection) return false;
  return isRedisReady(connection);
};

/** BullMQ custom job ids must not contain ":" */
const buildCampaignEmailJobId = (campaignId, recipientId) =>
  `${String(campaignId)}__${String(recipientId)}`;

const buildJobOpts = (jobData) => ({
  jobId: buildCampaignEmailJobId(jobData.campaignId, jobData.recipientId),
  removeOnComplete: true,
  removeOnFail: 200,
  attempts: 25,
  backoff: { type: 'exponential', delay: 5000 },
});

const enqueueCampaignEmailJobs = async (jobDataList = []) => {
  if (!jobDataList.length) return { queued: 0, via: 'none' };
  if (queue && connection && !isRedisReady(connection)) {
    await ensureRedisReady(connection);
  }
  if (!isCampaignEmailQueueAvailable()) return { queued: 0, via: 'unavailable' };

  const bulk = jobDataList.map((jobData) => ({
    name: 'send',
    data: jobData,
    opts: buildJobOpts(jobData),
  }));

  try {
    await queue.addBulk(bulk);
    return { queued: bulk.length, via: 'bullmq' };
  } catch (err) {
    logger.error('campaignEmailQueue', 'addBulk failed', { error: err.message, count: bulk.length });
    throw err;
  }
};

const removeCampaignJobsFromQueue = async (campaignId) => {
  if (!queue) return 0;

  const id = String(campaignId);
  let removed = 0;
  const states = ['waiting', 'delayed', 'paused'];

  for (const state of states) {
    let start = 0;
    const pageSize = 500;
    let jobs = [];

    do {
      jobs = await queue.getJobs([state], start, start + pageSize - 1, true);
      for (const job of jobs) {
        if (String(job.data?.campaignId) === id) {
          await job.remove();
          removed += 1;
        }
      }
      start += pageSize;
    } while (jobs.length === pageSize);
  }

  return removed;
};

module.exports = {
  QUEUE_NAME,
  buildCampaignEmailJobId,
  isCampaignEmailQueueAvailable,
  enqueueCampaignEmailJobs,
  removeCampaignJobsFromQueue,
  getCampaignEmailConnection: () => connection,
};
