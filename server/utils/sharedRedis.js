const Redis = require('ioredis');
const { getRedisUrl } = require('./wslRedis');

let sharedRedis = null;

const getSharedRedis = () => {
  if (sharedRedis) return sharedRedis;

  sharedRedis = new Redis(getRedisUrl(), {
    lazyConnect: true,
    enableOfflineQueue: false,
    connectTimeout: 5000,
    retryStrategy: (times) => {
      if (times > 3) return null;
      return Math.min(times * 50, 2000);
    },
    maxRetriesPerRequest: 1,
  });

  sharedRedis.on('error', () => {});

  return sharedRedis;
};

/** Lazy clients reject commands until connected when enableOfflineQueue is false. */
async function ensureSharedRedisReady() {
  const redis = getSharedRedis();
  const { status } = redis;

  if (status === 'ready') return redis;

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
    return redis;
  }

  if (status === 'wait' || status === 'end' || status === 'close') {
    await redis.connect();
  }

  return redis;
}

async function pingSharedRedis() {
  const redis = await ensureSharedRedisReady();
  return redis.ping();
}

module.exports = { getSharedRedis, ensureSharedRedisReady, pingSharedRedis };
