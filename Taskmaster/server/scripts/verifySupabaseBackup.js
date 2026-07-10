#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const {
  runDailyBackup,
  listAvailableBackups,
  getBackupDbName,
  getISTDateString,
  purgeAllMongoGridFsBackups,
  getSourceUri,
} = require('../services/databaseBackupService');
const { verifySupabaseBackup } = require('../services/supabase/backupStore');
const { closeSupabaseClients } = require('../services/supabase/client');

const formatBytes = (n) => {
  if (!n) return '0 B';
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
};

async function getMongoBackupStats(connection) {
  const backupDb = connection.useDb(getBackupDbName(), { useCache: false }).db;
  const [snapshots, files, chunks] = await Promise.all([
    backupDb.collection('backup_snapshots').countDocuments(),
    backupDb.collection('backup_archives.files').countDocuments(),
    backupDb.collection('backup_archives.chunks').countDocuments(),
  ]);
  const stats = await backupDb.stats().catch(() => ({}));
  return { snapshots, files, chunks, storageSizeBytes: stats.storageSize || 0 };
}

async function main() {
  const snapshotDate = getISTDateString();
  console.log('=== Supabase backup verification ===\n');

  const result = await runDailyBackup();
  console.log('Backup result:', {
    success: result.success,
    date: result.date,
    destination: result.destination,
    collectionCount: result.collectionCount,
    totalBytes: formatBytes(result.totalBytes),
    mongoPurge: result.supabase?.mongoPurge,
  });

  if (!result.success) {
    throw new Error(result.error || 'Backup failed');
  }

  const verification = await verifySupabaseBackup(result.date || snapshotDate);
  console.log('\nSupabase verification:', verification);

  const listing = await listAvailableBackups();
  console.log('\nListed backups:', {
    destination: listing.destination,
    backupDatabase: listing.backupDatabase,
    snapshots: (listing.snapshots || []).map((s) => ({
      date: s.date,
      collections: s.collectionCount,
      size: formatBytes(s.totalBytes),
    })),
  });

  const sourceUri = getSourceUri();
  const connection = await mongoose.createConnection(sourceUri).asPromise();
  const mongoAfter = await getMongoBackupStats(connection);
  console.log('\nMongo backup DB after purge:', mongoAfter);

  await connection.close();
  await closeSupabaseClients();

  if (!verification.ok) {
    throw new Error('Supabase backup verification failed');
  }
  if (mongoAfter.snapshots > 0 || mongoAfter.files > 0) {
    throw new Error('Mongo GridFS backups still present after purge');
  }

  console.log('\nPASS — Supabase backup verified; Mongo GridFS backups cleared.');
  process.exit(0);
}

main().catch(async (err) => {
  console.error('\nFAIL:', err.message);
  await closeSupabaseClients();
  process.exit(1);
});
