const { redis } = require('../services/cacheService');

/**
 * express-rate-limit store backed by shared Redis (falls back to in-memory per limiter).
 */
class RedisRateLimitStore {
  constructor({ prefix = 'rl:', windowMs = 60_000 } = {}) {
    this.prefix = prefix;
    this.windowMs = windowMs;
    this.local = new Map();
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async increment(key) {
    const redisKey = `${this.prefix}${key}`;
    const now = Date.now();
    const resetTime = new Date(now + this.windowMs);

    if (redis?.status === 'ready') {
      try {
        const count = await redis.incr(redisKey);
        if (count === 1) {
          await redis.pexpire(redisKey, this.windowMs);
        }
        return { totalHits: count, resetTime };
      } catch {
        /* fall through */
      }
    }

    const entry = this.local.get(redisKey);
    if (!entry || entry.resetTime <= now) {
      this.local.set(redisKey, { totalHits: 1, resetTime });
      return { totalHits: 1, resetTime };
    }
    entry.totalHits += 1;
    return { totalHits: entry.totalHits, resetTime: entry.resetTime };
  }

  async decrement(key) {
    const redisKey = `${this.prefix}${key}`;
    if (redis?.status === 'ready') {
      try {
        const count = await redis.decr(redisKey);
        if (count < 0) await redis.set(redisKey, '0', 'PX', this.windowMs);
      } catch {
        /* ignore */
      }
    }
    const entry = this.local.get(redisKey);
    if (entry && entry.totalHits > 0) entry.totalHits -= 1;
  }

  async resetKey(key) {
    const redisKey = `${this.prefix}${key}`;
    this.local.delete(redisKey);
    if (redis?.status === 'ready') {
      try {
        await redis.del(redisKey);
      } catch {
        /* ignore */
      }
    }
  }
}

module.exports = { RedisRateLimitStore };
