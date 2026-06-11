const {
  STORE,
  getSyncTargetForEvent,
  parseEventType,
  isLockedMongoEntity,
} = require('../../../../shared/dataOwnership');
const { writeToSupabase } = require('./supabaseSyncWriter');
const { writeToMongo } = require('./mongoSyncWriter');
const { bustCacheForDomainEvent } = require('../../hybridCache');

/**
 * Route a domain-sync job to the correct writer per ownership map.
 */
async function handleDomainSyncJob(job) {
  const { eventType, payload = {}, tenantId, entityId } = job.data || {};
  const target = getSyncTargetForEvent(eventType);
  const { entity } = parseEventType(eventType);
  const meta = { eventType, tenantId, entityId, jobId: job.id };

  if (!target || !entity) {
    return { skipped: true, reason: 'unknown_event', eventType };
  }

  if (isLockedMongoEntity(entity) && target === STORE.SUPABASE) {
    return { skipped: true, reason: 'locked_entity', entity };
  }

  let result;
  if (target === STORE.SUPABASE) {
    result = await writeToSupabase(entity, payload, meta);
  } else if (target === STORE.MONGO) {
    result = await writeToMongo(entity, payload, meta);
  } else {
    return { skipped: true, reason: 'no_target', eventType };
  }

  if (!result?.skipped) {
    await bustCacheForDomainEvent(eventType, payload).catch(() => {});
  }
  return result;

}

module.exports = { handleDomainSyncJob };
