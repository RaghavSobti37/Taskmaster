const cron = require('node-cron');
const logger = require('../utils/logger');
const { purgeStaleTaskActivity } = require('../services/taskActivityPurgeService');
const { getSharedRedis } = require('../utils/sharedRedis');

const redis = getSharedRedis();
const LOCK_KEY = 'task-activity-purge-lock';
const LOCK_TTL_SEC = 3600;

const acquireLock = async () => {
  try {
    if (!redis || typeof redis.set !== 'function' || redis.status !== 'ready') {
      return true;
    }
    const result = await redis.set(LOCK_KEY, 'locked', 'EX', LOCK_TTL_SEC, 'NX');
    return result === 'OK';
  } catch (err) {
    logger.warn('taskActivityPurge', 'Lock acquire failed', { error: err.message });
    return false;
  }
};

const releaseLock = async () => {
  try {
    if (!redis || typeof redis.del !== 'function' || redis.status !== 'ready') return;
    await redis.del(LOCK_KEY);
  } catch (err) {
    logger.warn('taskActivityPurge', 'Lock release failed', { error: err.message });
  }
};

const runPurge = async () => {
  const hasLock = await acquireLock();
  if (!hasLock) {
    logger.debug('taskActivityPurge', 'Skipping purge (lock held)');
    return;
  }
  try {
    await purgeStaleTaskActivity();
  } catch (err) {
    logger.error('taskActivityPurge', 'Purge failed', { error: err.message, persist: true });
  } finally {
    await releaseLock();
  }
};

const init = () => {
  cron.schedule('15 3 * * *', runPurge);
  logger.info('taskActivityPurge', 'Scheduled daily task activity purge (03:15)');
};

module.exports = { init, runPurge };
