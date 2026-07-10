const { config } = require('../config');
const { apiError } = require('../utils/apiResponse');
const { createRedisClient } = require('../utils/wslRedis');

let redis = null;

function getRedis() {
  if (redis) return redis;
  try {
    redis = createRedisClient({ maxRetriesPerRequest: 1 });
  } catch {
    redis = null;
  }
  return redis;
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

async function apiIdempotency(req, res, next) {
  if (!MUTATING.has(req.method)) return next();
  if (req.path.startsWith('/auth/login') || req.path.startsWith('/auth/register')) return next();

  const key = req.headers['x-idempotency-key'];
  if (!key || typeof key !== 'string' || key.length > 128) return next();

  const client = getRedis();
  if (!client) return next();

  const redisKey = `idempotency:${req.user?._id || 'anon'}:${key}`;
  try {
    if (!client.status || client.status === 'wait') await client.connect();
    const claimed = await client.set(redisKey, 'PROCESSING', 'NX', 'EX', 3600);
    if (!claimed) {
      return apiError(res, 'Duplicate transaction request in progress.', 409);
    }
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        client.set(redisKey, 'COMPLETED', 'EX', 3600).catch(() => {});
      } else {
        client.del(redisKey).catch(() => {});
      }
    });
  } catch {
    // ponytail: Redis optional in dev — skip idempotency when unavailable
  }
  return next();
}

module.exports = { apiIdempotency };
