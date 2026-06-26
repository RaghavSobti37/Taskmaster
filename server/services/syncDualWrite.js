/**
 * Dual-write pilot documents to Postgres when SYNC_DUAL_WRITE=true.
 * ponytail: fire-and-forget; consistency checker job handles drift alerts.
 */
const { config } = require('../config');
const logger = require('../utils/logger');

let prisma = null;

function isEnabled() {
  return String(config.SYNC_DUAL_WRITE || '').trim() === 'true' && Boolean(config.DATABASE_URL);
}

async function getPrisma() {
  if (!isEnabled()) return null;
  if (prisma) return prisma;
  try {
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient();
    return prisma;
  } catch (err) {
    logger.warn('SyncDualWrite', 'Prisma unavailable', { error: err.message });
    return null;
  }
}

function mapTask(doc) {
  if (!doc) return null;
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    id: String(plain._id || plain.id),
    tenantId: String(plain.tenantId),
    projectId: String(plain.projectId),
    title: plain.title || '',
    status: plain.status || 'todo',
    updatedAt: plain.updatedAt ? new Date(plain.updatedAt) : new Date(),
  };
}

async function upsertTask(doc) {
  const client = await getPrisma();
  const row = mapTask(doc);
  if (!client || !row?.id || !row.tenantId) return;

  client.task
    .upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        tenantId: row.tenantId,
        projectId: row.projectId,
        title: row.title,
        status: row.status,
        updatedAt: row.updatedAt,
      },
      update: {
        title: row.title,
        status: row.status,
        updatedAt: row.updatedAt,
      },
    })
    .catch((err) => {
      logger.warn('SyncDualWrite', 'Task upsert failed', { id: row.id, error: err.message });
    });
}

async function deleteTask(id) {
  const client = await getPrisma();
  if (!client || !id) return;
  client.task
    .delete({ where: { id: String(id) } })
    .catch((err) => {
      if (err?.code === 'P2025') return;
      logger.warn('SyncDualWrite', 'Task delete failed', { id, error: err.message });
    });
}

module.exports = { isEnabled, upsertTask, deleteTask };
