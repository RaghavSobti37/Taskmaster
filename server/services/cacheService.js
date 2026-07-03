const { getSharedRedis } = require('../utils/sharedRedis');

const redis = getSharedRedis();

/** In-memory fallback when Redis is down (local dev, outages). */
const memoryCache = new Map();
const MAX_MEMORY_ENTRIES = 800;

function pruneMemoryIfNeeded() {
  if (memoryCache.size < MAX_MEMORY_ENTRIES) return;
  const now = Date.now();
  for (const [key, entry] of memoryCache) {
    if (entry.expiresAt <= now) memoryCache.delete(key);
    if (memoryCache.size < MAX_MEMORY_ENTRIES * 0.9) break;
  }
  while (memoryCache.size >= MAX_MEMORY_ENTRIES) {
    const oldest = memoryCache.keys().next().value;
    memoryCache.delete(oldest);
  }
}

function memoryGet(key) {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

function memorySet(key, value, ttlSeconds) {
  pruneMemoryIfNeeded();
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

async function getCache(key) {
  if (process.env.NODE_ENV === 'test') return null;

  if (redis.status === 'ready') {
    try {
      const data = await redis.get(key);
      if (data) {
        const parsed = JSON.parse(data);
        memorySet(key, parsed, 60);
        return parsed;
      }
    } catch {
      /* fall through to memory */
    }
  }

  return memoryGet(key);
}

async function setCache(key, value, ttlSeconds = 21600) {
  if (process.env.NODE_ENV === 'test') return;

  memorySet(key, value, ttlSeconds);

  if (redis.status !== 'ready') return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    /* memory cache already set */
  }
}

async function deleteCache(key) {
  memoryCache.delete(key);
  if (redis.status !== 'ready') return;
  try {
    await redis.del(key);
  } catch {
    /* ignore */
  }
}

function bustMemoryByPrefix(prefix) {
  for (const key of [...memoryCache.keys()]) {
    if (key.startsWith(prefix)) memoryCache.delete(key);
  }
}

async function bustCacheByPrefix(prefix) {
  bustMemoryByPrefix(prefix);
  if (redis.status !== 'ready') return;
  try {
    const keys = await redis.keys(`${prefix}*`);
    if (keys.length) await redis.del(...keys);
  } catch {
    /* memory cache already cleared */
  }
}

module.exports = { getCache, setCache, deleteCache, bustCacheByPrefix, redis };
