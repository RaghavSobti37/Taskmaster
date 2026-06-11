/**
 * Supabase writer for domain-sync events (Phase 2+).
 * Uses PostgREST upsert via restQuery — IPv4-safe on Render.
 */

const { isSupabaseEnabled } = require('../../../config/supabase');
const { upsertRows, deleteRows } = require('../../supabase/restQuery');
const { getSupabaseTableForEntity } = require('../../../../shared/dataOwnership');
const { mapPayloadForEntity, normalizeId } = require('../syncPayloadMappers');
const logger = require('../../../utils/logger');

const SUPPORTED_ENTITIES = new Set(['Task', 'Lead', 'Attendance']);

async function writeToSupabase(entityName, payload, meta = {}) {
  if (!isSupabaseEnabled()) {
    return { skipped: true, reason: 'supabase_disabled' };
  }

  if (!SUPPORTED_ENTITIES.has(entityName)) {
    return { skipped: true, reason: 'entity_not_supported', entity: entityName };
  }

  if (meta.eventType?.endsWith('.deleted')) {
    const id = normalizeId(payload?.id || payload?._id);
    if (!id) return { skipped: true, reason: 'missing_id' };
    const table = getSupabaseTableForEntity(entityName);
    const filters = [['eq', ['id', id]]];
    if (payload.tenantId) {
      filters.push(['eq', ['tenantId', String(payload.tenantId)]]);
    }
    await deleteRows(table, filters);
    return { deleted: true, table, entity: entityName, id };
  }

  const row = mapPayloadForEntity(entityName, payload);
  if (!row?.id) {
    return { skipped: true, reason: 'invalid_payload', entity: entityName };
  }

  if (!row.tenantId && meta.tenantId) {
    row.tenantId = String(meta.tenantId);
  }

  const table = getSupabaseTableForEntity(entityName);
  try {
    const result = await upsertRows(table, [row], { onConflict: 'id' });
    logger.debug('domainSync', 'Supabase upsert', {
      entity: entityName,
      table,
      eventType: meta.eventType,
      entityId: row.id,
      count: result.count,
    });
    return { upserted: true, table, entity: entityName, count: result.count };
  } catch (err) {
    logger.warn('domainSync', 'Supabase upsert failed', {
      entity: entityName,
      table,
      eventType: meta.eventType,
      error: err.message,
    });
    throw err;
  }
}

module.exports = { writeToSupabase };
