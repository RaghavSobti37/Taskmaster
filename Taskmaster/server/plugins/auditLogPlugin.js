const mongoose = require('mongoose');
const logger = require('../utils/logger');

const AUDIT_COLLECTION = 'audit_logs';
const MAX_DIFF_BYTES = 4000;

function safeJson(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return { _error: 'unserializable' };
  }
}

function trimDiff(obj) {
  const raw = JSON.stringify(obj);
  if (raw.length <= MAX_DIFF_BYTES) return obj;
  return { _truncated: true, preview: raw.slice(0, MAX_DIFF_BYTES) };
}

/**
 * Mongoose plugin — audit create/update/delete on sensitive models.
 */
function auditLogPlugin(schema, options = {}) {
  const modelName = options.modelName || schema.options.collection || 'unknown';

  schema.post('save', async function auditOnSave(doc) {
    try {
      const action = doc.isNew ? 'create' : 'update';
      const conn = mongoose.connection;
      if (conn.readyState !== 1) return;
      await conn.collection(AUDIT_COLLECTION).insertOne({
        model: modelName,
        action,
        docId: String(doc._id),
        actorId: doc.$locals?.auditActorId || null,
        at: new Date(),
        diff: trimDiff(safeJson(doc.toObject({ depopulate: true }))),
      });
    } catch (err) {
      logger.warn('auditLog save', err?.message);
    }
  });

  schema.post('findOneAndUpdate', async function auditOnUpdate(res) {
    try {
      if (!res) return;
      const conn = mongoose.connection;
      if (conn.readyState !== 1) return;
      await conn.collection(AUDIT_COLLECTION).insertOne({
        model: modelName,
        action: 'update',
        docId: String(res._id),
        at: new Date(),
        diff: trimDiff(safeJson(res)),
      });
    } catch (err) {
      logger.warn('auditLog update', err?.message);
    }
  });

  schema.post('findOneAndDelete', async function auditOnDelete(res) {
    try {
      if (!res) return;
      const conn = mongoose.connection;
      if (conn.readyState !== 1) return;
      await conn.collection(AUDIT_COLLECTION).insertOne({
        model: modelName,
        action: 'delete',
        docId: String(res._id),
        at: new Date(),
      });
    } catch (err) {
      logger.warn('auditLog delete', err?.message);
    }
  });
}

module.exports = { auditLogPlugin, AUDIT_COLLECTION };
