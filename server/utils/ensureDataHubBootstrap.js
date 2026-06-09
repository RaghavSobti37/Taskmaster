/**
 * One-time bootstrap when personindexes is empty but legacy contacts/tscdatas exist.
 */
const logger = require('../utils/logger');

async function ensureDataHubBootstrap() {
  try {
    const personCount = await require('../models/PersonIndex').countDocuments();
    if (personCount === 0) {
      const legacyCount = await require('mongoose').connection.db.collection('contacts').countDocuments();
      if (legacyCount > 0) {
        logger.info('dataHubBootstrap', 'Running contacts split migration');
        await require('../scripts/migrateContactsSplit').main({ embedded: true });
      }
    }

    const outCount = await require('../models/OutsourcedRecord').countDocuments();
    const tscCount = await require('mongoose').connection.db.collection('tscdatas').countDocuments();
    if (tscCount > 0 && outCount === 0) {
      logger.info('dataHubBootstrap', 'Running TSC fragment migration');
      await require('../scripts/migrateTscDataFragment').main({ embedded: true });
    }

    const personSpineCount = await require('../models/Person').countDocuments();
    const hubViewCount = await require('../models/PersonHubView').countDocuments();
    const indexCount = await require('../models/PersonIndex').countDocuments();
    const hubIncomplete = hubViewCount > 0 && indexCount > 0 && hubViewCount < indexCount * 0.9;
    if (personSpineCount === 0 || hubViewCount === 0 || hubIncomplete) {
      logger.info('dataHubBootstrap', 'Running personId backfill + hub rebuild', {
        personSpineCount,
        hubViewCount,
        indexCount,
        hubIncomplete,
      });
      await require('../scripts/backfillPersonIds').main({ embedded: true });
    }
  } catch (err) {
    logger.warn('dataHubBootstrap', 'Bootstrap skipped or failed', { error: err.message });
  }
}

module.exports = { ensureDataHubBootstrap };
