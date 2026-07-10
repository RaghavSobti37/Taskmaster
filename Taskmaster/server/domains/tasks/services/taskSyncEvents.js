/**
 * Fire-and-forget domain-sync events for tasks (dual-write scaffold).
 */

const { publishDomainEvent } = require('../../../services/sync/eventBus');
const {
  mapTaskRow,
  mapTaskActivityRow,
  normalizeId,
} = require('../../../services/sync/syncPayloadMappers');

function toPlainDoc(doc) {
  if (!doc) return null;
  return doc.toObject ? doc.toObject() : doc;
}

function emit(eventType, payload, options = {}) {
  if (!payload) return;
  publishDomainEvent(eventType, payload, options).catch(() => {});
}

function publishTaskCreated(task) {
  const row = mapTaskRow(toPlainDoc(task));
  if (!row) return;
  emit('task.created', row, { tenantId: row.tenantId, entityId: row.id });
}

function publishTaskUpdated(task) {
  const row = mapTaskRow(toPlainDoc(task));
  if (!row) return;
  emit('task.updated', row, { tenantId: row.tenantId, entityId: row.id });
}

function publishTaskDeleted(task) {
  const plain = toPlainDoc(task);
  const id = normalizeId(plain?.id || plain?._id);
  if (!id) return;
  emit('task.deleted', { id, tenantId: normalizeId(plain?.tenantId) }, {
    tenantId: normalizeId(plain?.tenantId),
    entityId: id,
  });
}

function publishTaskActivity(activity) {
  const row = mapTaskActivityRow(toPlainDoc(activity));
  if (!row) return;
  emit('task.activity', row, {
    tenantId: row.tenantId,
    entityId: row._id,
  });
}

module.exports = {
  publishTaskCreated,
  publishTaskUpdated,
  publishTaskDeleted,
  publishTaskActivity,
};
