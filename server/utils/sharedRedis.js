const Redis = require('ioredis');
const { getRedisUrl } = require('./wslRedis');

let sharedRedis = null;

const getSharedRedis = () => {
  if (sharedRedis) return sharedRedis;

  sharedRedis = new Redis(getRedisUrl(), {
    retryStrategy: (times) => {
      if (times > 3) return null;
      return Math.min(times * 50, 2000);
    },
    maxRetriesPerRequest: 1,
  });

  sharedRedis.on('error', () => {});

  return sharedRedis;
};

module.exports = { getSharedRedis };
