const { getSharedRedis } = require('../utils/sharedRedis');

const redis = getSharedRedis();

async function getCache(key) {
  if (process.env.NODE_ENV === 'test') return null;
  if (redis.status !== 'ready') return null;
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

async function setCache(key, value, ttlSeconds = 21600) {
  if (process.env.NODE_ENV === 'test') return;
  if (redis.status !== 'ready') return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (e) {}
}

module.exports = { getCache, setCache, redis };
