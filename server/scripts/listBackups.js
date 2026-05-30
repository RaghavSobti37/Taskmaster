#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { listAvailableBackups, getBackupDbName } = require('../services/databaseBackupService');

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const main = async () => {
  try {
    const backups = await listAvailableBackups();
    const backupDb = getBackupDbName();

    if (!backups.length) {
      console.log(`No backups found in database "${backupDb}".`);
      process.exit(0);
    }

    console.log(`Backup database: ${backupDb}\n`);
    for (const snap of backups) {
      console.log(`Date: ${snap.date}`);
      console.log(`  Status: ${snap.status}`);
      console.log(`  Created: ${snap.createdAt?.toISOString?.() || snap.createdAt}`);
      console.log(`  Expires: ${snap.expiresAt?.toISOString?.() || snap.expiresAt}`);
      console.log(`  Collections (${snap.collectionCount}): ${(snap.collections || []).join(', ')}`);
      console.log(`  Total size: ${formatBytes(snap.totalBytes)}`);
      console.log('');
    }
  } catch (error) {
    console.error('Failed to list backups:', error.message);
    process.exit(1);
  }
};

main();
