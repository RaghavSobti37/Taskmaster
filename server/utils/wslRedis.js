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
      const wslIps = execSync('wsl hostname -I', { encoding: 'utf8' }).trim();
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

module.exports = { getRedisUrl };
