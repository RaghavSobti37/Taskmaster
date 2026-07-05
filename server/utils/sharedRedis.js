const { createRedisClient } = require('./wslRedis');
const logger = require('./logger');

let sharedRedis = null;
let redisUnreachable = false;
let redisWarnLogged = false;

const getSharedRedis = () => {
  if (sharedRedis) return sharedRedis;
  sharedRedis = createRedisClient({ maxRetriesPerRequest: 1, connectTimeout: 5000 });
  return sharedRedis;
};

/** Lazy clients reject commands until connected when enableOfflineQueue is false. */
async function ensureSharedRedisReady() {
  const redis = getSharedRedis();
  const { status } = redis;

  if (status === 'ready') {
    redisUnreachable = false;
    return redis;
  }

  if (redisUnreachable) {
    throw new Error('Redis unavailable');
  }

  if (status === 'connecting') {
    await new Promise((resolve, reject) => {
      const onReady = () => cleanup(resolve);
      const onError = (err) => cleanup(() => reject(err));
      const cleanup = (fn) => {
        redis.removeListener('ready', onReady);
        redis.removeListener('error', onError);
        fn();
      };
      redis.once('ready', onReady);
      redis.once('error', onError);
    });
    redisUnreachable = false;
    return redis;
  }

  if (status === 'wait' || status === 'end' || status === 'close') {
    try {
      await redis.connect();
      redisUnreachable = false;
    } catch (err) {
      redisUnreachable = true;
      if (!redisWarnLogged) {
        redisWarnLogged = true;
        logger.warn('redis', 'Unavailable — in-memory fallbacks active', { error: err.message });
      }
      throw err;
    }
  }

  return redis;
}

async function pingSharedRedis() {
  const redis = await ensureSharedRedisReady();
  return redis.ping();
}

module.exports = { getSharedRedis, ensureSharedRedisReady, pingSharedRedis };
