/**
 * Redis cache layer for hybrid read pilots (Phase 4).
 * Keys defined in shared/dataOwnership.js REDIS_CACHE_KEYS.
 */

const { REDIS_CACHE_KEYS } = require('../../shared/dataOwnership');
const { getCache, setCache, bustCacheByPrefix } = require('./cacheService');
const { getSharedRedis } = require('../utils/sharedRedis');

const DEFAULT_TTL = 300;

function fillKey(pattern, vars = {}) {
  return Object.entries(vars).reduce(
    (key, [name, value]) => key.replace(`{${name}}`, String(value ?? '')),
    pattern,
  );
}

async function bustPattern(pattern) {
  const redis = getSharedRedis();
  if (!redis || redis.status !== 'ready') return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length) await redis.del(...keys);
  } catch (_) {}
}

async function getAttendanceStatsCache(userId, rangeKey) {
  const key = fillKey(REDIS_CACHE_KEYS.ATTENDANCE_STATS, { userId, rangeKey });
  return getCache(key);
}

async function setAttendanceStatsCache(userId, rangeKey, value, ttlSeconds = DEFAULT_TTL) {
  const key = fillKey(REDIS_CACHE_KEYS.ATTENDANCE_STATS, { userId, rangeKey });
  await setCache(key, value, ttlSeconds);
}

async function getTaskListCountsCache(tenantId, userId, scopeKey) {
  const key = fillKey(REDIS_CACHE_KEYS.TASK_LIST_COUNTS, { tenantId, userId, scopeKey });
  return getCache(key);
}

async function setTaskListCountsCache(tenantId, userId, scopeKey, value, ttlSeconds = DEFAULT_TTL) {
  const key = fillKey(REDIS_CACHE_KEYS.TASK_LIST_COUNTS, { tenantId, userId, scopeKey });
  await setCache(key, value, ttlSeconds);
}

async function bustAttendanceCacheForUser(userId) {
  if (!userId) return;
  const prefix = fillKey(REDIS_CACHE_KEYS.ATTENDANCE_STATS, { userId, rangeKey: '' });
  await bustCacheByPrefix(prefix);
}

async function bustTaskCountsForTenant(tenantId) {
  if (!tenantId) return;
  await bustPattern(fillKey(REDIS_CACHE_KEYS.TASK_LIST_COUNTS, { tenantId, userId: '*', scopeKey: '*' }));
}

async function bustCacheForDomainEvent(eventType, payload = {}) {
  if (eventType.startsWith('attendance.')) {
    const userId = payload.userId || payload.userId?.toString?.();
    if (userId) await bustAttendanceCacheForUser(String(userId));
    return;
  }
  if (eventType.startsWith('task.')) {
    const tenantId = payload.tenantId;
    if (tenantId) await bustTaskCountsForTenant(String(tenantId));
  }
}

module.exports = {
  getAttendanceStatsCache,
  setAttendanceStatsCache,
  getTaskListCountsCache,
  setTaskListCountsCache,
  bustAttendanceCacheForUser,
  bustTaskCountsForTenant,
  bustCacheForDomainEvent,
};
