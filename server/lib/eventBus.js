const logger = require('../utils/logger');

let publisher = null;

async function getPublisher() {
  if (publisher) return publisher;
  try {
    const { redis } = require('../services/cacheService');
    if (redis?.status === 'ready') {
      publisher = redis;
      return publisher;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Publish domain event to Redis stream + optional socket emit callback.
 */
async function publishEvent(stream, event, payload = {}, { emit } = {}) {
  const entry = {
    stream,
    event,
    payload,
    at: new Date().toISOString(),
  };

  try {
    const redis = await getPublisher();
    if (redis?.xAdd) {
      await redis.xAdd(`events:${stream}`, '*', {
        event,
        payload: JSON.stringify(payload),
        at: entry.at,
      });
    }
  } catch (err) {
    logger.warn('eventBus redis', err?.message);
  }

  if (typeof emit === 'function') {
    try {
      emit(event, payload);
    } catch (err) {
      logger.warn('eventBus emit', err?.message);
    }
  }

  return entry;
}

module.exports = { publishEvent };
