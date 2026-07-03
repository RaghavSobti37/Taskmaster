const crypto = require('crypto');
const { createRedisClient } = require('../utils/wslRedis');
const { config } = require('../config');

const TTL_SECONDS = 24 * 60 * 60;
const KEY_PREFIX = 'wh:idemp:';

/** @type {Map<string, number>} */
const memoryStore = new Map();

let redis = null;
let redisReady = false;

function initRedis() {
  if (config.isTest) return;

  try {
    redis = createRedisClient({ maxRetriesPerRequest: 1 });

    redis.connect()
      .then(() => { redisReady = true; })
      .catch(() => { redisReady = false; });

    redis.on('error', () => { redisReady = false; });
  } catch {
    redisReady = false;
  }
}

initRedis();

function pruneMemoryStore() {
  const now = Date.now();
  for (const [key, expiresAt] of memoryStore.entries()) {
    if (expiresAt <= now) memoryStore.delete(key);
  }
}

function extractIdempotencyKey(req) {
  const svixId = req.headers['svix-id']
    || req.headers['resend-webhook-id']
    || req.headers['x-resend-webhook-id'];
  if (svixId) return `svix:${String(svixId).trim()}`;

  const headerId = req.headers['x-idempotency-key'] || req.headers['x-webhook-id'];
  if (headerId) return `hdr:${String(headerId).trim()}`;

  const raw = req.rawBody
    ? req.rawBody.toString('utf8')
    : JSON.stringify(req.body || {});
  const hash = crypto.createHash('sha256').update(`${req.originalUrl}:${raw}`).digest('hex');
  return `body:${hash}`;
}

async function claimKey(key) {
  const fullKey = KEY_PREFIX + key;

  if (redisReady && redis) {
    try {
      const result = await redis.set(fullKey, '1', 'EX', TTL_SECONDS, 'NX');
      return result === 'OK';
    } catch {
      redisReady = false;
    }
  }

  if (memoryStore.size > 5000) pruneMemoryStore();

  const now = Date.now();
  const expiresAt = memoryStore.get(fullKey);
  if (expiresAt && expiresAt > now) return false;

  memoryStore.set(fullKey, now + TTL_SECONDS * 1000);
  return true;
}

/**
 * Drop duplicate webhook deliveries. Replays return 200 { ok: true, duplicate: true }.
 * Uses Redis when available; falls back to in-memory Map with TTL in dev.
 */
async function webhookIdempotency(req, res, next) {
  if (req.method !== 'POST') return next();

  try {
    const key = extractIdempotencyKey(req);
    const isNew = await claimKey(key);
    if (!isNew) {
      return res.status(200).json({ ok: true, duplicate: true });
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { webhookIdempotency, extractIdempotencyKey, claimKey };
