#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const logger = require('../utils/logger');
const { runDailyBackup } = require('../services/databaseBackupService');
const { notifyBackupResult } = require('../services/backupNotificationService');

const isEnabled = () => {
  const flag = (process.env.BACKUP_ENABLED || 'true').trim().toLowerCase();
  return flag !== 'false' && flag !== '0';
};

const main = async () => {
  if (!isEnabled()) {
    logger.info('DailyBackup', 'BACKUP_ENABLED=false — skipping backup run');
    process.exit(0);
  }

  logger.info('DailyBackup', 'Starting scheduled production backup');

  let result;
  try {
    result = await runDailyBackup();
  } catch (error) {
    result = {
      success: false,
      date: null,
      error: error.message,
      durationMs: 0,
      backupDatabase: process.env.MONGODB_BACKUP_DB || 'coreknot_backups',
      retentionCount: parseInt(process.env.BACKUP_RETENTION_COUNT || '2', 10),
      collections: [],
      collectionCount: 0,
      totalBytes: 0,
    };
  }

  try {
    await notifyBackupResult(result);
  } catch (emailError) {
    logger.error('DailyBackup', 'Failed to send backup notification email', {
      error: emailError.message,
    });
    if (result.success) {
      process.exit(1);
    }
  }

  if (result.success) {
    logger.info('DailyBackup', 'Backup completed successfully', {
      date: result.date,
      collectionCount: result.collectionCount,
      totalBytes: result.totalBytes,
    });
    process.exit(0);
  }

  logger.error('DailyBackup', 'Backup failed', { error: result.error });
  process.exit(1);
};

main();
