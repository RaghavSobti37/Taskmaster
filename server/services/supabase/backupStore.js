const zlib = require('zlib');
const { SUPABASE_BACKUP_BUCKET } = require('../../config/supabase');
const { isSupabaseEnabled } = require('../../config/supabase');
const { getSupabaseClient, queryPg, preferRestPostgres } = require('./client');
const { upsertRows, selectRows, deleteRows } = require('./restQuery');
const logger = require('../../utils/logger');

const CURSOR_BATCH_SIZE = 500;
const COLLECTION_PAUSE_MS = 100;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function snapshotRow(snapshot) {
  return {
    snapshot_date: snapshot.date,
    status: snapshot.status || 'completed',
    source_database: snapshot.sourceDatabase || null,
    backup_database: snapshot.backupDatabase || 'supabase',
    collection_count: snapshot.collectionCount || 0,
    total_bytes: snapshot.totalBytes || 0,
    collections: snapshot.collections || [],
    source_db_stats: snapshot.sourceDbStats || null,
  };
}

async function upsertSnapshotMetadata(snapshot) {
  if (preferRestPostgres()) {
    await upsertRows('backup_snapshots', [snapshotRow(snapshot)], { onConflict: 'snapshot_date' });
    return;
  }
  await queryPg(
    `insert into backup_snapshots (
      snapshot_date, status, source_database, backup_database,
      collection_count, total_bytes, collections, source_db_stats
    ) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)
    on conflict (snapshot_date) do update set
      status = excluded.status,
      source_database = excluded.source_database,
      backup_database = excluded.backup_database,
      collection_count = excluded.collection_count,
      total_bytes = excluded.total_bytes,
      collections = excluded.collections,
      source_db_stats = excluded.source_db_stats,
      created_at = now()`,
    [
      snapshot.date,
      snapshot.status || 'completed',
      snapshot.sourceDatabase || null,
      snapshot.backupDatabase || 'supabase',
      snapshot.collectionCount || 0,
      snapshot.totalBytes || 0,
      JSON.stringify(snapshot.collections || []),
      JSON.stringify(snapshot.sourceDbStats || null),
    ]
  );
}

async function upsertBackupFileMeta({
  snapshotDate,
  collectionName,
  storagePath,
  documentCount,
  compressedBytes,
}) {
  if (preferRestPostgres()) {
    await upsertRows('backup_files', [{
      snapshot_date: snapshotDate,
      collection_name: collectionName,
      storage_path: storagePath,
      document_count: documentCount,
      compressed_bytes: compressedBytes,
    }], { onConflict: 'snapshot_date,collection_name' });
    return;
  }
  await queryPg(
    `insert into backup_files (
      snapshot_date, collection_name, storage_path, document_count, compressed_bytes
    ) values ($1,$2,$3,$4,$5)
    on conflict (snapshot_date, collection_name) do update set
      storage_path = excluded.storage_path,
      document_count = excluded.document_count,
      compressed_bytes = excluded.compressed_bytes,
      created_at = now()`,
    [snapshotDate, collectionName, storagePath, documentCount, compressedBytes]
  );
}

async function exportCollectionToSupabase(sourceDb, snapshotDate, collectionName) {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase client unavailable');
  }

  const sourceCollection = sourceDb.collection(collectionName);
  const gzipStream = zlib.createGzip();
  const compressedChunks = [];

  gzipStream.on('data', (chunk) => compressedChunks.push(chunk));

  let documentCount = 0;
  const cursor = sourceCollection.find({}).batchSize(CURSOR_BATCH_SIZE);

  for await (const doc of cursor) {
    const line = `${JSON.stringify(doc)}\n`;
    if (!gzipStream.write(line)) {
      await new Promise((resolve) => gzipStream.once('drain', resolve));
    }
    documentCount += 1;
  }

  await new Promise((resolve, reject) => {
    gzipStream.on('end', resolve);
    gzipStream.on('error', reject);
    gzipStream.end();
  });

  const compressed = Buffer.concat(compressedChunks);
  const storagePath = `${snapshotDate}/${collectionName}.json.gz`;

  const { error } = await client.storage
    .from(SUPABASE_BACKUP_BUCKET)
    .upload(storagePath, compressed, {
      contentType: 'application/gzip',
      upsert: true,
    });

  if (error) throw error;

  return {
    collectionName,
    documentCount,
    compressedBytes: compressed.length,
    storagePath,
  };
}

async function runSupabaseProductionBackup({
  sourceDb,
  snapshotDate,
  collectionNames,
  sourceDbStats = {},
  onProgress,
}) {
  if (!isSupabaseEnabled()) {
    return { skipped: true, reason: 'disabled' };
  }

  const exported = [];
  const total = collectionNames.length;

  await upsertSnapshotMetadata({
    date: snapshotDate,
    status: 'running',
    sourceDatabase: sourceDbStats.sourceDatabase || sourceDb.databaseName,
    backupDatabase: SUPABASE_BACKUP_BUCKET,
    collectionCount: 0,
    totalBytes: 0,
    collections: [],
    sourceDbStats: {
      sourceDataSizeBytes: sourceDbStats.dataSizeBytes,
      sourceIndexSizeBytes: sourceDbStats.indexSizeBytes,
      sourceStorageSizeBytes: sourceDbStats.storageSizeBytes,
      sourceTotalSizeBytes: sourceDbStats.totalSizeBytes,
    },
  });

  for (let i = 0; i < collectionNames.length; i += 1) {
    const collectionName = collectionNames[i];
    if (onProgress) {
      onProgress({
        currentCollection: collectionName,
        completedCollections: i,
        totalCollections: total,
        percent: total > 0 ? Math.min(99, Math.round((i / total) * 100)) : 1,
      });
    }

    const row = await exportCollectionToSupabase(sourceDb, snapshotDate, collectionName);
    exported.push(row);
    await upsertBackupFileMeta({
      snapshotDate,
      collectionName: row.collectionName,
      storagePath: row.storagePath,
      documentCount: row.documentCount,
      compressedBytes: row.compressedBytes,
    });
    logger.info('SupabaseBackup', `Uploaded ${collectionName}`, row);
    await sleep(COLLECTION_PAUSE_MS);
  }

  const totalBytes = exported.reduce((sum, row) => sum + row.compressedBytes, 0);

  await upsertSnapshotMetadata({
    date: snapshotDate,
    status: 'completed',
    sourceDatabase: sourceDbStats.sourceDatabase || sourceDb.databaseName,
    backupDatabase: SUPABASE_BACKUP_BUCKET,
    collectionCount: exported.length,
    totalBytes,
    collections: exported,
    sourceDbStats: {
      sourceDataSizeBytes: sourceDbStats.dataSizeBytes,
      sourceIndexSizeBytes: sourceDbStats.indexSizeBytes,
      sourceStorageSizeBytes: sourceDbStats.storageSizeBytes,
      sourceTotalSizeBytes: sourceDbStats.totalSizeBytes,
    },
  });

  if (onProgress) {
    onProgress({
      currentCollection: null,
      completedCollections: total,
      totalCollections: total,
      percent: 100,
    });
  }

  return {
    skipped: false,
    destination: 'supabase',
    backupDatabase: SUPABASE_BACKUP_BUCKET,
    collectionCount: exported.length,
    totalBytes,
    collections: exported,
  };
}

async function mirrorBackupResultToSupabase({ sourceDb, snapshotDate, backupResult }) {
  const collectionNames = (backupResult.collections || []).map((c) => c.collectionName);
  return runSupabaseProductionBackup({
    sourceDb,
    snapshotDate,
    collectionNames,
    sourceDbStats: {
      sourceDatabase: backupResult.sourceDatabase,
      dataSizeBytes: backupResult.sourceDataSizeBytes,
      indexSizeBytes: backupResult.sourceIndexSizeBytes,
      storageSizeBytes: backupResult.sourceStorageSizeBytes,
      totalSizeBytes: backupResult.sourceTotalSizeBytes,
    },
  });
}

async function pruneOldSupabaseSnapshots(maxSnapshots) {
  const client = getSupabaseClient();
  if (!client) return { deletedSnapshots: 0, deletedFiles: 0 };

  let snapshots;
  if (preferRestPostgres()) {
    snapshots = await selectRows('backup_snapshots', {
      columns: 'snapshot_date,status',
      filters: [['eq', ['status', 'completed']]],
      order: { column: 'snapshot_date', ascending: false },
    });
  } else {
    const result = await queryPg(
      `select snapshot_date::text as snapshot_date
       from backup_snapshots
       where status = 'completed'
       order by snapshot_date desc`
    );
    snapshots = result.rows;
  }

  const toDelete = snapshots.slice(maxSnapshots);
  let deletedFiles = 0;

  for (const snap of toDelete) {
    const snapshotDate = String(snap.snapshot_date).slice(0, 10);
    let files;
    if (preferRestPostgres()) {
      files = await selectRows('backup_files', {
        columns: 'storage_path',
        filters: [['eq', ['snapshot_date', snapshotDate]]],
      });
    } else {
      const result = await queryPg(
        'select storage_path from backup_files where snapshot_date = $1::date',
        [snapshotDate]
      );
      files = result.rows;
    }

    if (files.length) {
      const paths = files.map((f) => f.storage_path);
      const { error } = await client.storage.from(SUPABASE_BACKUP_BUCKET).remove(paths);
      if (error) {
        logger.warn('SupabaseBackup', `Storage prune warning for ${snapshotDate}`, { error: error.message });
      }
      deletedFiles += paths.length;
    }

    if (preferRestPostgres()) {
      await deleteRows('backup_snapshots', [['eq', ['snapshot_date', snapshotDate]]]);
    } else {
      await queryPg('delete from backup_snapshots where snapshot_date = $1::date', [snapshotDate]);
    }
    logger.info('SupabaseBackup', `Pruned snapshot ${snapshotDate}`, { maxSnapshots });
  }

  return { deletedSnapshots: toDelete.length, deletedFiles, kept: maxSnapshots };
}

async function verifySupabaseBackup(snapshotDate) {
  let snapshots;
  let fileRows;
  let storagePathRows;

  if (preferRestPostgres()) {
    snapshots = await selectRows('backup_snapshots', {
      columns: 'snapshot_date,status,collection_count,total_bytes,created_at',
      filters: [['eq', ['snapshot_date', snapshotDate]]],
    });
    const files = await selectRows('backup_files', {
      columns: 'compressed_bytes,storage_path',
      filters: [['eq', ['snapshot_date', snapshotDate]]],
    });
    fileRows = [{
      file_count: files.length,
      total_bytes: files.reduce((sum, row) => sum + Number(row.compressed_bytes || 0), 0),
    }];
    storagePathRows = files.slice(0, 5);
    snapshots = snapshots.map((row) => ({
      date: row.snapshot_date,
      status: row.status,
      collection_count: row.collection_count,
      total_bytes: row.total_bytes,
      created_at: row.created_at,
    }));
  } else {
    const snapResult = await queryPg(
      `select snapshot_date::text as date, status, collection_count, total_bytes, created_at
       from backup_snapshots where snapshot_date = $1::date`,
      [snapshotDate]
    );
    snapshots = snapResult.rows;
    const fileResult = await queryPg(
      `select count(*)::int as file_count, coalesce(sum(compressed_bytes), 0)::bigint as total_bytes
       from backup_files where snapshot_date = $1::date`,
      [snapshotDate]
    );
    fileRows = fileResult.rows;
    const pathResult = await queryPg(
      'select storage_path from backup_files where snapshot_date = $1::date limit 5',
      [snapshotDate]
    );
    storagePathRows = pathResult.rows;
  }

  if (!snapshots.length) {
    return { ok: false, reason: `No snapshot metadata for ${snapshotDate}` };
  }

  const client = getSupabaseClient();
  const storagePaths = { rows: storagePathRows };

  let storageOk = 0;
  if (client && storagePaths.rows.length) {
    for (const row of storagePaths.rows) {
      const { data, error } = await client.storage
        .from(SUPABASE_BACKUP_BUCKET)
        .download(row.storage_path);
      if (!error && data) storageOk += 1;
    }
  }

  const meta = snapshots[0];
  const files = fileRows[0] || { file_count: 0, total_bytes: 0 };
  const ok = Number(meta.collection_count) > 0
    && Number(files.file_count) > 0
    && (storagePaths.rows.length === 0 || storageOk > 0);

  return {
    ok,
    snapshotDate,
    status: meta.status,
    collectionCount: Number(meta.collection_count),
    totalBytes: Number(meta.total_bytes || files.total_bytes || 0),
    fileCount: Number(files.file_count),
    storageSampleVerified: storageOk,
    storageSampleChecked: storagePaths.rows.length,
  };
}

async function listSupabaseBackups() {
  let rows;
  if (preferRestPostgres()) {
    const data = await selectRows('backup_snapshots', {
      columns: 'snapshot_date,status,collection_count,total_bytes,created_at',
      order: { column: 'snapshot_date', ascending: false },
    });
    rows = data.map((row) => ({
      date: row.snapshot_date,
      created_at: row.created_at,
      status: row.status,
      collection_count: row.collection_count,
      total_bytes: row.total_bytes,
    }));
  } else {
    const result = await queryPg(
      `select snapshot_date::text as date, status, collection_count, total_bytes, created_at
       from backup_snapshots
       order by snapshot_date desc`
    );
    rows = result.rows;
  }
  return rows.map((row) => ({
    date: row.date,
    createdAt: row.created_at,
    status: row.status,
    collectionCount: Number(row.collection_count || 0),
    totalBytes: Number(row.total_bytes || 0),
    destination: 'supabase',
  }));
}

module.exports = {
  exportCollectionToSupabase,
  runSupabaseProductionBackup,
  mirrorBackupResultToSupabase,
  pruneOldSupabaseSnapshots,
  listSupabaseBackups,
  verifySupabaseBackup,
  upsertSnapshotMetadata,
};
