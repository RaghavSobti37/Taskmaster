const cron = require('node-cron');
const logger = require('../utils/logger');
const { backupAllLeadsToCsv } = require('../services/csvBackupService');

// Run everyday at midnight (0 0 * * *)
const backupCron = cron.schedule('0 0 * * *', async () => {
  logger.info('Backup', 'Starting scheduled database backup...');
  try {
    backupAllLeadsToCsv();
    logger.info('Backup', `Scheduled backup triggered`);
  } catch(e) {
    logger.error('Backup', `Scheduled backup failed: ${e.message}`);
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
