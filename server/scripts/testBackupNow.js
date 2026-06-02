#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const {
  runDailyBackup,
  listAvailableBackups,
  getSourceUri,
  getBackupDbName,
  getISTDateString,
} = require('../services/databaseBackupService');
const { notifyBackupResult } = require('../services/backupNotificationService');

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
};

const getDatabaseSizeStats = async (db) => {
  const stats = await db.stats();
  return {
    database: db.databaseName,
    dataSizeBytes: stats.dataSize || 0,
    storageSizeBytes: stats.storageSize || 0,
    indexSizeBytes: stats.indexSize || 0,
    totalSizeBytes: (stats.dataSize || 0) + (stats.indexSize || 0),
    collections: stats.collections || 0,
  };
};

const getBackupCompressedSize = async (backupDb) => {
  const filesCol = backupDb.collection('backup_archives.files');
  const chunksCol = backupDb.collection('backup_archives.chunks');
  const snapshotsCol = backupDb.collection('backup_snapshots');

  const [filesAgg, chunksAgg, snapshotsAgg] = await Promise.all([
    filesCol.aggregate([{ $group: { _id: null, total: { $sum: '$length' }, count: { $sum: 1 } } }]).toArray(),
    chunksCol.aggregate([{ $group: { _id: null, total: { $sum: { $bsonSize: '$$ROOT' } } } }]).toArray(),
    snapshotsCol.aggregate([{ $group: { _id: null, total: { $sum: '$totalBytes' }, count: { $sum: 1 } } }]).toArray(),
  ]);

  const gridfsFileBytes = filesAgg[0]?.total || 0;
  const snapshotTotalBytes = snapshotsAgg[0]?.total || 0;
  const fileCount = filesAgg[0]?.count || 0;
  const snapshotCount = snapshotsAgg[0]?.count || 0;

  const backupStats = await backupDb.stats().catch(() => ({}));

  return {
    gridfsCompressedBytes: gridfsFileBytes,
    snapshotReportedBytes: snapshotTotalBytes,
    gridfsFileCount: fileCount,
    snapshotCount,
    backupDbStorageSizeBytes: backupStats.storageSize || 0,
    chunksApproxBytes: chunksAgg[0]?.total || 0,
  };
};

const main = async () => {
  let connection;
  try {
    const sourceUri = getSourceUri();
    const backupDbName = getBackupDbName();

    connection = await mongoose.createConnection(sourceUri, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 120000,
    }).asPromise();

    const sourceDb = connection.db;
    const backupDb = connection.useDb(backupDbName, { useCache: false }).db;

    const prodBefore = await getDatabaseSizeStats(sourceDb);

    console.log('\n=== Production DB (before backup) ===');
    console.log(`Database: ${prodBefore.database}`);
    console.log(`Collections: ${prodBefore.collections}`);
    console.log(`Data size: ${formatBytes(prodBefore.dataSizeBytes)}`);
    console.log(`Index size: ${formatBytes(prodBefore.indexSizeBytes)}`);
    console.log(`Storage size (on disk): ${formatBytes(prodBefore.storageSizeBytes)}`);
    console.log(`Logical total (data + indexes): ${formatBytes(prodBefore.totalSizeBytes)}`);

    const result = await runDailyBackup();

    if (!result.success) {
      console.error('\nBackup FAILED:', result.error);
      process.exit(1);
    }

    const backupSize = await getBackupCompressedSize(backupDb);

    console.log('\n=== Backup run result ===');
    console.log(`Snapshot date (IST): ${result.date}`);
    console.log(`Collections backed up: ${result.collectionCount}`);
    console.log(`Duration: ${Math.round(result.durationMs / 1000)}s`);
    console.log(`Compressed backup size (GridFS files): ${formatBytes(result.totalBytes)}`);

    console.log('\n=== Backup DB (coreknot_backups) ===');
    console.log(`GridFS compressed bytes: ${formatBytes(backupSize.gridfsCompressedBytes)}`);
    console.log(`GridFS file count: ${backupSize.gridfsFileCount}`);
    console.log(`Snapshot records: ${backupSize.snapshotCount}`);
    console.log(`Backup DB storage on disk: ${formatBytes(backupSize.backupDbStorageSizeBytes)}`);

    const ratio = prodBefore.dataSizeBytes
      ? ((result.totalBytes / prodBefore.dataSizeBytes) * 100).toFixed(1)
      : 'N/A';
    console.log(`\nCompression ratio vs prod data size: ${ratio}%`);

    const backups = await listAvailableBackups();
    console.log(`\nAvailable snapshots: ${backups.map((b) => b.date).join(', ') || 'none'}`);

    try {
      await notifyBackupResult(result);
      console.log('\nNotification email dispatched.');
    } catch (emailErr) {
      console.warn('\nBackup OK but email failed:', emailErr.message);
    }

    console.log('\nBackup test completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.close();
  }
};

main();
