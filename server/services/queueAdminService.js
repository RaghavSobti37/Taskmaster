const { isRedisAvailable, getManagedQueues } = require('./backgroundQueue');

const summarizeFailedJob = (job) => ({
  id: job.id,
  name: job.name,
  failedReason: job.failedReason || null,
  timestamp: job.timestamp || null,
  finishedOn: job.finishedOn || null,
  attemptsMade: job.attemptsMade ?? null,
});

const summarizeQueue = async ({ name, queue }) => {
  try {
    const [waiting, active, failed, delayed, completed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.getCompletedCount(),
    ]);
    const failedJobs = await queue.getFailed(0, 15);
    return {
      name,
      waiting,
      active,
      failed,
      delayed,
      completed,
      recentFailed: failedJobs.map(summarizeFailedJob),
    };
  } catch (error) {
    return {
      name,
      waiting: 0,
      active: 0,
      failed: 0,
      delayed: 0,
      completed: 0,
      recentFailed: [],
      error: error.message || 'Queue unavailable',
    };
  }
};

const getExtraQueues = async () => {
  const extras = [];
  try {
    const { importQueue } = require('../workers/importWorker');
    if (importQueue) extras.push({ name: 'CsvImportQueue', queue: importQueue });
  } catch {
    /* optional */
  }
  return extras;
};

const getQueueAdminSnapshot = async () => {
  if (!isRedisAvailable()) {
    return { redisAvailable: false, queues: [] };
  }
  try {
    const entries = [...getManagedQueues(), ...(await getExtraQueues())];
    const queues = await Promise.all(entries.map(summarizeQueue));
    return { redisAvailable: true, queues };
  } catch (error) {
    return {
      redisAvailable: false,
      queues: [],
      error: error.message || 'Failed to load queue status',
    };
  }
};

const cleanFailedJobs = async () => {
  if (!isRedisAvailable()) {
    return { cleaned: 0, queues: [], redisAvailable: false };
  }

  const entries = [...getManagedQueues(), ...(await getExtraQueues())];
  const queues = [];
  let cleaned = 0;

  for (const { name, queue } of entries) {
    if (!queue) continue;
    try {
      const count = await queue.getFailedCount();
      if (count > 0) {
        await queue.clean(0, count, 'failed');
        cleaned += count;
        queues.push({ name, cleaned: count });
      }
    } catch (error) {
      queues.push({ name, error: error.message || 'Clean failed' });
    }
  }

  return { cleaned, queues, redisAvailable: true };
};

module.exports = {
  getQueueAdminSnapshot,
  cleanFailedJobs,
};
