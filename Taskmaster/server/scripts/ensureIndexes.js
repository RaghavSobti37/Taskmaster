/**
 * Performance index sync — deferred 60s after boot so first API requests
 * are not competing with syncIndexes.
 *
 * Called from startServer.js runMongoBootstrapOnce().
 * Errors are caught and logged as warnings — never block boot.
 */
const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Sync MongoDB indexes for performance-critical collections.
 * Runs syncIndexes on each registered model so any index schema changes
 * (new compound indexes, TTL changes, etc.) are applied without a migration.
 *
 * References:
 *   - https://mongoosejs.com/docs/api/model.html#Model.syncIndexes()
 */
async function ensurePerformanceIndexes() {
  const modelNames = mongoose.modelNames();

  if (modelNames.length === 0) {
    logger.warn('INDEX', 'No mongoose models registered — skipping index sync');
    return;
  }

  const results = [];
  for (const name of modelNames) {
    try {
      const model = mongoose.model(name);
      await model.syncIndexes();
      results.push({ model: name, status: 'ok' });
    } catch (err) {
      // Log per-model failures but keep going
      logger.warn('INDEX', `syncIndexes failed for ${name}`, { error: err.message });
      results.push({ model: name, status: 'error', error: err.message });
    }
  }

  const ok = results.filter((r) => r.status === 'ok').length;
  const failed = results.filter((r) => r.status === 'error').length;
  logger.info('INDEX', `Index sync complete — ${ok} ok, ${failed} failed`, {
    total: results.length,
    ok,
    failed,
  });
}

module.exports = { ensurePerformanceIndexes };
