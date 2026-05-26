const cron = require('node-cron');
const { spawn } = require('child_process');
const path = require('path');
const logger = require('../utils/logger');

// Run everyday at midnight (0 0 * * *)
const backupCron = cron.schedule('0 0 * * *', () => {
  logger.info('Backup', 'Starting scheduled database backup...');
  
  const backupScriptPath = path.join(__dirname, '../scripts/backupDatabase.js');
  
  // Note: For this automated job, you might want a modified backupScript that doesn't switch the .env file!
  const child = spawn('node', [backupScriptPath, '--no-switch']);

  child.stdout.on('data', (data) => {
    logger.info('Backup', data.toString().trim());
  });

  child.stderr.on('data', (data) => {
    logger.error('Backup', data.toString().trim());
  });

  child.on('close', (code) => {
    logger.info('Backup', `Scheduled backup completed with code ${code}`);
  });
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
