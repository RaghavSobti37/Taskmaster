const { config } = require('../config');
const crypto = require('crypto');
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

function stableStringify(value) {
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function idempotencyRedisKey(req, key) {
  const tenant = req.tenantId ? String(req.tenantId) : 'no-tenant';
  const bearer = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const actor = req.apiKeyPrefix || (bearer && bearer.startsWith('ck_live_'))
    ? `api-key:${req.apiKeyPrefix || digest(bearer)}`
    : `user:${req.user?._id || 'anon'}`;
  const route = req.originalUrl || req.path || req.url || '/';
  const bodyHash = digest(stableStringify(req.body || {}));
  const keyHash = digest(key);
  return `idempotency:${tenant}:${actor}:${req.method}:${route}:${bodyHash}:${keyHash}`;
}

async function apiIdempotency(req, res, next) {
  if (!MUTATING.has(req.method)) return next();
  if (req.path.startsWith('/auth/login') || req.path.startsWith('/auth/register')) return next();

  const key = req.headers['x-idempotency-key'];
  if (!key || typeof key !== 'string' || key.length > 128) return next();

  const client = getRedis();
  if (!client) return next();

  const redisKey = idempotencyRedisKey(req, key);
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
