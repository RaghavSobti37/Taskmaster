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
      const { execFileSync } = require('child_process');
      const wslIp = execFileSync('wsl', ['hostname', '-I'])
        .toString()
        .trim()
        .split(' ')[0];
      if (wslIp) {
        redisUrl = `redis://${wslIp}:6379`;
      }
    } catch (err) {
      // Silent fallback — WSL not available
    }
  }

  return redisUrl;
};

module.exports = { getRedisUrl };
