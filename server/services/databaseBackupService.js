const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const zlib = require('zlib');
const logger = require('../utils/logger');

const GRIDFS_BUCKET = 'backup_archives';
const SNAPSHOTS_COLLECTION = 'backup_snapshots';
const COLLECTION_PAUSE_MS = 100;
const CURSOR_BATCH_SIZE = 500;

const LOCAL_DB_NAMES = new Set([
  'coreknot_local',
  'coreknot',
  'testing',
  'taskmaster',
  'taskmaster_local',
]);

const backupProgressState = {
  status: 'idle',
  snapshotDate: null,
  totalCollections: 0,
  completedCollections: 0,
  currentCollection: null,
  percent: 0,
  startedAt: null,
  finishedAt: null,
  error: null,
  result: null,
};

const getBackupProgress = () => ({ ...backupProgressState });

const resetBackupProgress = (snapshotDate) => {
  Object.assign(backupProgressState, {
    status: 'running',
    snapshotDate,
    totalCollections: 0,
    completedCollections: 0,
    currentCollection: 'Connecting…',
    percent: 0,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
    result: null,
  });
};

const patchBackupProgress = (patch) => {
  Object.assign(backupProgressState, patch);
  const { totalCollections, completedCollections } = backupProgressState;
  if (totalCollections > 0) {
    backupProgressState.percent = Math.min(
      99,
      Math.round((completedCollections / totalCollections) * 100)
    );
  }
};

const finishBackupProgress = (result) => {
  Object.assign(backupProgressState, {
    status: result.success ? 'completed' : 'failed',
    percent: result.success ? 100 : backupProgressState.percent,
    finishedAt: new Date().toISOString(),
    error: result.error || null,
    result,
    currentCollection: null,
    completedCollections: result.success
      ? backupProgressState.totalCollections || result.collectionCount
      : backupProgressState.completedCollections,
  });
};

const extractDbNameFromUri = (uri) => {
  const withoutQuery = uri.split('?')[0];
  const segments = withoutQuery.split('/');
  return (segments[segments.length - 1] || '').trim();
};

const isLocalMongoTarget = (uri) => {
  if (/localhost|127\.0\.0\.1|::1/i.test(uri)) return true;
  const dbName = extractDbNameFromUri(uri);
  return LOCAL_DB_NAMES.has(dbName);
};

const getSourceUri = () => {
  const prodUri = (process.env.MONGODB_URI_PROD || '').trim();
  const isProdRuntime = process.env.NODE_ENV === 'production';
  const fallbackUri = isProdRuntime ? (process.env.MONGODB_URI || '').trim() : '';
  const uri = prodUri || fallbackUri;
  if (!uri) {
    throw new Error(
      'MONGODB_URI_PROD is required for backups. Local MONGODB_URI is never used.'
    );
  }
  if (isLocalMongoTarget(uri)) {
    const dbName = extractDbNameFromUri(uri);
    throw new Error(
      `Refusing to backup local database "${dbName}". Set MONGODB_URI_PROD to the production Atlas URI only.`
    );
  }
  return uri;
};

const getBackupDbName = () => (process.env.MONGODB_BACKUP_DB || 'taskmaster_backups').trim();

const getRetentionCount = () => {
  const parsed = parseInt(process.env.BACKUP_RETENTION_COUNT || '2', 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 2;
};

/** @deprecated Use getRetentionCount — kept for scripts/docs that reference days. */
const getRetentionDays = () => getRetentionCount();

const getISTDateString = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

const subtractDaysFromDateString = (dateStr, days) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() - days);
  return utc.toISOString().slice(0, 10);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getGridFSBucket = (backupDb) =>
  new GridFSBucket(backupDb, { bucketName: GRIDFS_BUCKET });

const deleteSnapshotFiles = async (backupDb, snapshotDate) => {
  const bucket = getGridFSBucket(backupDb);
  const filesCol = backupDb.collection(`${GRIDFS_BUCKET}.files`);
  const files = await filesCol.find({ filename: { $regex: `^${snapshotDate}/` } }).toArray();

  for (const file of files) {
    await bucket.delete(file._id);
  }

  return files.length;
};

const pruneOldSnapshots = async (backupDb, maxSnapshots) => {
  const snapshotsCol = backupDb.collection(SNAPSHOTS_COLLECTION);
  const snapshots = await snapshotsCol
    .find({ status: 'completed' })
    .sort({ date: -1, createdAt: -1 })
    .toArray();

  const toDelete = snapshots.slice(maxSnapshots);
  if (!toDelete.length) {
    logger.info('DatabaseBackup', 'No excess snapshots to prune', { maxSnapshots, kept: snapshots.length });
    return { deletedSnapshots: 0, deletedFiles: 0, kept: snapshots.length };
  }

  let deletedFiles = 0;
  for (const snapshot of toDelete) {
    deletedFiles += await deleteSnapshotFiles(backupDb, snapshot.date);
    await snapshotsCol.deleteOne({ _id: snapshot._id });
    logger.info('DatabaseBackup', `Pruned snapshot ${snapshot.date}`, { maxSnapshots });
  }

  return { deletedSnapshots: toDelete.length, deletedFiles, kept: maxSnapshots };
};

const removeExistingSnapshot = async (backupDb, snapshotDate) => {
  const snapshotsCol = backupDb.collection(SNAPSHOTS_COLLECTION);
  await deleteSnapshotFiles(backupDb, snapshotDate);
  await snapshotsCol.deleteMany({ date: snapshotDate });
};

const exportCollection = async (sourceDb, backupDb, snapshotDate, collectionName) => {
  const sourceCollection = sourceDb.collection(collectionName);
  const bucket = getGridFSBucket(backupDb);
  const filename = `${snapshotDate}/${collectionName}.json.gz`;
  const gzip = zlib.createGzip();
  const uploadStream = bucket.openUploadStream(filename, {
    metadata: { snapshotDate, collectionName },
  });

  gzip.pipe(uploadStream);

  let documentCount = 0;
  const cursor = sourceCollection.find({}).batchSize(CURSOR_BATCH_SIZE);

  for await (const doc of cursor) {
    const line = `${JSON.stringify(doc)}\n`;
    if (!gzip.write(line)) {
      await new Promise((resolve) => gzip.once('drain', resolve));
    }
    documentCount += 1;
  }

  gzip.end();

  await new Promise((resolve, reject) => {
    uploadStream.on('finish', resolve);
    uploadStream.on('error', reject);
    gzip.on('error', reject);
  });

  await backupDb.collection(`${GRIDFS_BUCKET}.files`).updateOne(
    { _id: uploadStream.id },
    { $set: { 'metadata.documentCount': documentCount } }
  );

  const fileDoc = await backupDb.collection(`${GRIDFS_BUCKET}.files`).findOne({ _id: uploadStream.id });

  return {
    collectionName,
    documentCount,
    compressedBytes: fileDoc?.length || 0,
  };
};

const listSourceCollections = async (sourceDb) => {
  const collections = await sourceDb.listCollections().toArray();
  return collections
    .map((col) => col.name)
    .filter((name) => !name.startsWith('system.'));
};

const getProductionDatabaseStats = async (sourceDb) => {
  const stats = await sourceDb.stats();
  const dataSizeBytes = stats.dataSize || 0;
  const indexSizeBytes = stats.indexSize || 0;
  return {
    sourceDatabase: sourceDb.databaseName,
    dataSizeBytes,
    indexSizeBytes,
    storageSizeBytes: stats.storageSize || 0,
    totalSizeBytes: dataSizeBytes + indexSizeBytes,
    collectionCount: stats.collections || 0,
  };
};

const runDailyBackup = async () => {
  const startedAt = Date.now();
  const snapshotDate = getISTDateString();
  const retentionCount = getRetentionCount();
  const backupDbName = getBackupDbName();
  let connection;

  resetBackupProgress(snapshotDate);

  try {
    const sourceUri = getSourceUri();
    connection = await mongoose.createConnection(sourceUri, {
      readPreference: 'secondaryPreferred',
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 120000,
    }).asPromise();

    const sourceDb = connection.db;
    const backupDb = connection.useDb(backupDbName, { useCache: false }).db;
    const sourceDbStats = await getProductionDatabaseStats(sourceDb);

    logger.info('DatabaseBackup', 'Starting daily backup', {
      snapshotDate,
      backupDbName,
      sourceDb: sourceDb.databaseName,
      retentionCount,
      sourceDataSizeBytes: sourceDbStats.dataSizeBytes,
    });

    await removeExistingSnapshot(backupDb, snapshotDate);

    const collectionNames = await listSourceCollections(sourceDb);
    patchBackupProgress({
      totalCollections: collectionNames.length,
      currentCollection: 'Starting export…',
      percent: 1,
    });
    const exportedCollections = [];
    let totalBytes = 0;

    for (let i = 0; i < collectionNames.length; i += 1) {
      const collectionName = collectionNames[i];
      patchBackupProgress({ currentCollection: collectionName });
      const result = await exportCollection(sourceDb, backupDb, snapshotDate, collectionName);
      exportedCollections.push(result);
      totalBytes += result.compressedBytes;
      patchBackupProgress({ completedCollections: i + 1 });
      logger.info('DatabaseBackup', `Backed up ${collectionName}`, result);
      await sleep(COLLECTION_PAUSE_MS);
    }

    await backupDb.collection(SNAPSHOTS_COLLECTION).insertOne({
      date: snapshotDate,
      createdAt: new Date(),
      status: 'completed',
      collections: exportedCollections,
      totalBytes,
      sourceDbStats,
      sourceDatabase: sourceDb.databaseName,
      backupDatabase: backupDbName,
    });

    const cleanup = await pruneOldSnapshots(backupDb, retentionCount);

    const durationMs = Date.now() - startedAt;

    const successResult = {
      success: true,
      date: snapshotDate,
      collections: exportedCollections,
      collectionCount: exportedCollections.length,
      totalBytes,
      durationMs,
      backupDatabase: backupDbName,
      sourceDatabase: sourceDbStats.sourceDatabase,
      sourceDataSizeBytes: sourceDbStats.dataSizeBytes,
      sourceIndexSizeBytes: sourceDbStats.indexSizeBytes,
      sourceStorageSizeBytes: sourceDbStats.storageSizeBytes,
      sourceTotalSizeBytes: sourceDbStats.totalSizeBytes,
      retentionCount,
      cleanup,
    };
    finishBackupProgress(successResult);
    return successResult;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    logger.error('DatabaseBackup', 'Daily backup failed', { error: error.message, snapshotDate });

    const failureResult = {
      success: false,
      date: snapshotDate,
      collections: [],
      collectionCount: 0,
      totalBytes: 0,
      durationMs,
      backupDatabase: backupDbName,
      retentionCount,
      error: error.message,
    };
    finishBackupProgress(failureResult);
    return failureResult;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
};

const listAvailableBackups = async () => {
  const sourceUri = getSourceUri();
  const backupDbName = getBackupDbName();
  let connection;

  try {
    connection = await mongoose.createConnection(sourceUri, {
      serverSelectionTimeoutMS: 30000,
    }).asPromise();

    const backupDb = connection.useDb(backupDbName, { useCache: false }).db;
    const snapshots = await backupDb
      .collection(SNAPSHOTS_COLLECTION)
      .find({})
      .sort({ date: -1 })
      .toArray();

    return snapshots.map((snap) => ({
      date: snap.date,
      createdAt: snap.createdAt,
      status: snap.status,
      collectionCount: snap.collections?.length || 0,
      collections: (snap.collections || []).map((c) => c.collectionName),
      totalBytes: snap.totalBytes || 0,
      expiresAt: snap.expiresAt,
    }));
  } finally {
    if (connection) {
      await connection.close();
    }
  }
};

const readBackupCollection = async (snapshotDate, collectionName) => {
  const sourceUri = getSourceUri();
  const backupDbName = getBackupDbName();
  let connection;

  try {
    connection = await mongoose.createConnection(sourceUri, {
      serverSelectionTimeoutMS: 30000,
    }).asPromise();

    const backupDb = connection.useDb(backupDbName, { useCache: false }).db;
    const bucket = getGridFSBucket(backupDb);
    const filename = `${snapshotDate}/${collectionName}.json.gz`;
    const file = await backupDb.collection(`${GRIDFS_BUCKET}.files`).findOne({ filename });

    if (!file) {
      throw new Error(`Backup not found for ${snapshotDate}/${collectionName}`);
    }

    const downloadStream = bucket.openDownloadStream(file._id);
    const gunzip = zlib.createGunzip();
    const chunks = [];

    await new Promise((resolve, reject) => {
      downloadStream
        .pipe(gunzip)
        .on('data', (chunk) => chunks.push(chunk))
        .on('end', resolve)
        .on('error', reject);
    });

    const ndjson = Buffer.concat(chunks).toString('utf8');
    const documents = ndjson
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    return documents;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
};

module.exports = {
  runDailyBackup,
  listAvailableBackups,
  readBackupCollection,
  getProductionDatabaseStats,
  getISTDateString,
  getBackupDbName,
  getRetentionCount,
  getRetentionDays,
  getSourceUri,
  isLocalMongoTarget,
  getBackupProgress,
};
