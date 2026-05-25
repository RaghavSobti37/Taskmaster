const Redis = require('ioredis');

let redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
// Windows WSL fallback
if (process.platform === 'win32' && (!process.env.REDIS_URL || process.env.REDIS_URL.includes('127.0.0.1') || process.env.REDIS_URL.includes('localhost'))) {
  try {
    const { execFileSync } = require('child_process');
    const wslIp = execFileSync('wsl', ['hostname', '-I']).toString().trim().split(' ')[0];
    if (wslIp) {
      redisUrl = `redis://${wslIp}:6379`;
    }
  } catch (e) {}
}

const redis = new Redis(redisUrl, {
  retryStrategy: (times) => {
    if (times > 3) return null; // stop retrying
    return Math.min(times * 50, 2000);
  },
  maxRetriesPerRequest: 1
});

redis.on('error', () => {
  // Silent fail
});

async function getCache(key) {
  if (redis.status !== 'ready') return null;
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

async function setCache(key, value, ttlSeconds = 21600) { // Default 6 hours
  if (redis.status !== 'ready') return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (e) {}
}

module.exports = { getCache, setCache, redis };
