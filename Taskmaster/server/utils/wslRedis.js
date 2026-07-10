/**
 * WSL Redis URL resolver.
 * On Windows, detects WSL IP for Redis connection when no explicit REDIS_URL is set.
 * Centralizes the WSL detection logic previously duplicated across 3 services.
 */
const getRedisUrl = () => {
  let redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

  if (
    process.platform === 'win32' &&
    (!process.env.REDIS_URL ||
      process.env.REDIS_URL.includes('127.0.0.1') ||
      process.env.REDIS_URL.includes('localhost'))
  ) {
    try {
      const { execSync } = require('child_process');
      const wslIps = execSync('wsl hostname -I', { stdio: 'pipe' }).toString();
      const firstIp = wslIps.split(' ')[0].trim();
      if (firstIp) {
        redisUrl = `redis://${firstIp}:6379`;
      }
    } catch (err) {
      // Silent fallback
    }
  }

  return redisUrl;
};

/**
 * Shared ioredis factory — lazy connect, no reconnect spam, swallowed errors.
 * @param {import('ioredis').RedisOptions} [overrides]
 */
const createRedisClient = (overrides = {}) => {
  const Redis = require('ioredis');
  const client = new Redis(getRedisUrl(), {
    maxRetriesPerRequest: overrides.maxRetriesPerRequest ?? null,
    lazyConnect: true,
    connectTimeout: 2000,
    enableOfflineQueue: false,
    retryStrategy: () => null,
    ...overrides,
  });
  client.on('error', () => {});
  return client;
};

const isRedisReady = (client) => client?.status === 'ready';
const REDIS_CONNECTING_STATUSES = new Set(['connecting', 'connect', 'reconnecting']);

async function ensureRedisReady(client) {
  if (isRedisReady(client)) return true;
  if (!client) return false;

  try {
    if (REDIS_CONNECTING_STATUSES.has(client.status)) {
      await new Promise((resolve, reject) => {
        const cleanup = () => {
          client.removeListener('ready', onReady);
          client.removeListener('error', onError);
        };
        const onReady = () => {
          cleanup();
          resolve();
        };
        const onError = (err) => {
          cleanup();
          reject(err);
        };
        client.once('ready', onReady);
        client.once('error', onError);
      });
    } else {
      await client.connect();
    }
    return isRedisReady(client);
  } catch {
    return false;
  }
}

module.exports = { getRedisUrl, createRedisClient, isRedisReady, ensureRedisReady };
