const crypto = require('crypto');
const logger = require('./logger');

const REVOKE_PREFIX = 'revoked:jti:';
const memoryRevoked = new Map();

let redisClient = null;
let redisReady = false;

const getRedis = () => {
  if (redisClient !== null) return redisClient;
  try {
    const { createRedisClient } = require('./wslRedis');
    redisClient = createRedisClient({ maxRetriesPerRequest: 1 });
    redisClient.connect()
      .then(() => { redisReady = true; })
      .catch(() => { redisReady = false; });
    redisClient.on('error', () => { redisReady = false; });
  } catch {
    redisClient = false;
  }
  return redisClient;
};

const pruneMemory = () => {
  const now = Date.now();
  for (const [jti, expMs] of memoryRevoked.entries()) {
    if (expMs <= now) memoryRevoked.delete(jti);
  }
};

const ttlSecondsFromDecoded = (decoded) => {
  if (decoded?.exp && Number.isFinite(decoded.exp)) {
    const remaining = decoded.exp - Math.floor(Date.now() / 1000);
    return Math.max(remaining, 60);
  }
  const days = Number(process.env.JWT_EXPIRES_IN?.replace?.('d', '')) || 7;
  return days * 24 * 60 * 60;
};

const revokeToken = async (decoded) => {
  const jti = decoded?.jti;
  if (!jti) return;
  const ttl = ttlSecondsFromDecoded(decoded);
  const key = `${REVOKE_PREFIX}${jti}`;
  const redis = getRedis();
  if (redis && redisReady) {
    try {
      await redis.set(key, '1', 'EX', ttl);
      return;
    } catch (err) {
      logger.warn('tokenRevocation', 'Redis revoke failed; using memory fallback', { error: err.message });
    }
  }
  pruneMemory();
  memoryRevoked.set(jti, Date.now() + ttl * 1000);
};

const isTokenRevoked = async (decoded) => {
  const jti = decoded?.jti;
  if (!jti) return false;
  const key = `${REVOKE_PREFIX}${jti}`;
  const redis = getRedis();
  if (redis && redisReady) {
    try {
      const hit = await redis.get(key);
      return hit === '1';
    } catch {
      /* fall through */
    }
  }
  pruneMemory();
  const expMs = memoryRevoked.get(jti);
  if (!expMs) return false;
  if (expMs <= Date.now()) {
    memoryRevoked.delete(jti);
    return false;
  }
  return true;
};

const newJti = () => crypto.randomUUID();

module.exports = {
  revokeToken,
  isTokenRevoked,
  newJti,
  _resetForTests: () => {
    memoryRevoked.clear();
    redisReady = false;
    redisClient = null;
  },
};
