const cron = require('node-cron');
const logger = require('../utils/logger');
const { MODULE } = require('../../shared/systemLogContract');
const { backupAllLeadsToCsv } = require('../services/csvBackupService');

// Deprecated: full DB backup now runs via Render cron (server/scripts/runDailyBackup.js).
// This job only exported CRM leads to CSV. Kept for reference; not started from server.js.

// Run everyday at midnight (0 0 * * *)
const backupCron = cron.schedule('0 0 * * *', async () => {
  logger.info('Backup', 'Starting scheduled database backup...');
  try {
    backupAllLeadsToCsv();
    logger.info('Backup', `Scheduled backup triggered`);
  } catch(e) {
    logger.error('Backup', `Scheduled backup failed: ${e.message}`, {
      persist: true,
      module: MODULE.BACKUP,
      payload: { error: e.message },
    });
  }

}, {
  scheduled: false // Default to false until explicitly started
});

module.exports = {
  start: () => {
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_CRON_BACKUPS === 'true') {
      backupCron.start();
      logger.info('Backup', 'Automated nightly backups initialized.');
    }
  },
  stop: () => backupCron.stop()
};
