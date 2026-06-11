/**
 * Mongo writer for domain-sync events (activity, audits).
 * Phase 3: task.activity → TaskActivity (idempotent upsert).
 */

const mongoose = require('mongoose');
const { isLockedMongoEntity } = require('../../../../shared/dataOwnership');
const { mapTaskActivityRow, normalizeId } = require('../syncPayloadMappers');
const logger = require('../../../utils/logger');

async function writeTaskActivity(payload, meta = {}) {
  const TaskActivity = require('../../../domains/tasks/models/TaskActivity');
  const row = mapTaskActivityRow(payload);
  if (!row) return { skipped: true, reason: 'invalid_activity_payload' };

  const existing = await TaskActivity.findById(row._id).setOptions({ bypassTenant: true }).lean();
  if (existing) {
    return { skipped: true, reason: 'already_exists', entityId: row._id };
  }

  await TaskActivity.collection.insertOne({
    ...row,
    _id: new mongoose.Types.ObjectId(row._id),
    taskId: new mongoose.Types.ObjectId(row.taskId),
    actorId: new mongoose.Types.ObjectId(row.actorId),
    ...(row.tenantId ? { tenantId: new mongoose.Types.ObjectId(row.tenantId) } : {}),
    ...(row.assigneeId ? { assigneeId: new mongoose.Types.ObjectId(row.assigneeId) } : {}),
    ...(row.assignedById ? { assignedById: new mongoose.Types.ObjectId(row.assignedById) } : {}),
    mentionedUserIds: (row.mentionedUserIds || []).map((id) => new mongoose.Types.ObjectId(id)),
  });

  logger.debug('domainSync', 'TaskActivity inserted via event bus', {
    eventType: meta.eventType,
    entityId: row._id,
  });
  return { inserted: true, entity: 'TaskActivity', entityId: row._id };
}

async function writeToMongo(entityName, payload, meta = {}) {
  if (isLockedMongoEntity(entityName)) {
    logger.debug('domainSync', 'Mongo locked entity — no writer', {
      entity: entityName,
      eventType: meta.eventType,
    });
    return { skipped: true, locked: true, entity: entityName };
  }

  if (meta.eventType === 'task.activity' || entityName === 'TaskActivity') {
    return writeTaskActivity(payload, meta);
  }

  logger.debug('domainSync', 'Mongo writer noop', {
    entity: entityName,
    eventType: meta.eventType,
    entityId: normalizeId(payload?.id || payload?._id),
  });

  return { skipped: true, reason: 'mongo_noop', entity: entityName };
}

module.exports = { writeToMongo };
