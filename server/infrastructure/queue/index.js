const { config } = require('../../config');

/**
 * Queue infrastructure — BullMQ via ioredis.
 * See jobs/registry.js for worker catalog.
 */
function getRedisUrl() {
  return config.redis.url;
}

function isRedisConfigured() {
  return Boolean(config.redis.url);
}

module.exports = {
  getRedisUrl,
  isRedisConfigured,
};
