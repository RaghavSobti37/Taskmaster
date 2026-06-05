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
  const entries = [...getManagedQueues(), ...(await getExtraQueues())];
  const queues = await Promise.all(entries.map(summarizeQueue));
  return { redisAvailable: true, queues };
};

module.exports = {
  getQueueAdminSnapshot,
};
