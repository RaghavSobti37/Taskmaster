#!/usr/bin/env node
/**
 * Atlas M0 storage audit + safe cleanup for shared cluster (local + prod + backups).
 *
 * Default is dry-run (read-only counts). Pass --execute to delete.
 *
 * Usage:
 *   node scripts/atlasStorageCleanup.js                    # audit all DBs
 *   node scripts/atlasStorageCleanup.js --dry-run          # same
 *   node scripts/atlasStorageCleanup.js --execute          # run safe prunes
 *   node scripts/atlasStorageCleanup.js --execute --only logs,mail,backups
 *   node scripts/atlasStorageCleanup.js --execute --days 90
 *   node scripts/atlasStorageCleanup.js --execute --db local|prod|backups|all
 *
 * Env: MONGODB_URI, MONGODB_URI_PROD, MONGODB_BACKUP_DB (from server/.env)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

const ORPHAN_COLLECTIONS = [
  'chatmessages',
  'chatchannels',
  'messages',
  'socialpostmetadata',
  'departmentchangerequests',
  'logarchives',
  'crmauditarchives',
  'connectedprofiles',
];

const MAIL_TEST_EMAIL_RE = /^(test-bounce|test@example\.com|qa-|exly-test-|artist\.enquiry\.test@|workflow_test)/i;

const args = process.argv.slice(2);
const execute = args.includes('--execute');
const dryRun = !execute || args.includes('--dry-run');
const daysArg = args.find((a) => a.startsWith('--days='));
const pruneDays = daysArg ? Number(daysArg.split('=')[1]) : 30;
const onlyArg = args.find((a) => a.startsWith('--only='));
const onlyTargets = onlyArg
  ? onlyArg.split('=')[1].split(',').map((s) => s.trim().toLowerCase())
  : ['logs', 'mail', 'qa', 'backups', 'orphans'];
const dbArg = args.find((a) => a.startsWith('--db='));
const dbScope = dbArg ? dbArg.split('=')[1].toLowerCase() : 'all';

function dbNameFromUri(uri, fallback) {
  if (!uri) return fallback;
  const match = uri.match(/mongodb(\+srv)?:\/\/[^/]+\/([^?]+)/i);
  return match && match[2] ? decodeURIComponent(match[2]) : fallback;
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function clusterFromUri(uri) {
  const match = uri.match(/@([^/]+)\//);
  return match ? match[1] : 'unknown';
}

async function collStats(db, name) {
  try {
    const s = await db.command({ collStats: name });
    return {
      name,
      count: s.count ?? 0,
      size: s.size ?? 0,
      storageSize: s.storageSize ?? 0,
      totalIndexSize: s.totalIndexSize ?? 0,
      avgObjSize: s.avgObjSize ?? 0,
    };
  } catch {
    return { name, count: 0, size: 0, storageSize: 0, totalIndexSize: 0, avgObjSize: 0, missing: true };
  }
}

async function auditDatabase(client, dbName) {
  const db = client.db(dbName);
  const stats = await db.stats();
  const collections = await db.listCollections().toArray();
  const rows = [];
  for (const { name } of collections) {
    rows.push(await collStats(db, name));
  }
  rows.sort((a, b) => (b.storageSize + b.totalIndexSize) - (a.storageSize + a.totalIndexSize));
  return {
    dbName,
    dataSize: stats.dataSize || 0,
    storageSize: stats.storageSize || 0,
    indexSize: stats.indexSize || 0,
    billedBytes: (stats.dataSize || 0) + (stats.indexSize || 0),
    collectionCount: stats.collections || collections.length,
    rows,
  };
}

function printAudit(report) {
  console.log(`\nCluster host: ${report.clusterHost}`);
  console.log(`Mode: ${dryRun ? 'DRY-RUN (read-only)' : 'EXECUTE (deletes enabled)'}`);
  console.log(`Prune age: ${pruneDays} days | Targets: ${onlyTargets.join(', ')} | DB scope: ${dbScope}`);
  console.log(`\nAtlas M0 quota is per-cluster (all DBs share 512 MB). Billed ≈ dataSize + indexSize.\n`);

  let clusterBilled = 0;
  for (const db of report.databases) {
    clusterBilled += db.billedBytes;
    console.log(`=== ${db.dbName} ===`);
    console.log(
      `  data ${formatBytes(db.dataSize)} | storage ${formatBytes(db.storageSize)} | index ${formatBytes(db.indexSize)} | billed ${formatBytes(db.billedBytes)} | cols ${db.collectionCount}`
    );
    console.log('  Top collections (data + index):');
    for (const row of db.rows.slice(0, 12)) {
      if (row.missing) continue;
      const billed = row.size + row.totalIndexSize;
      console.log(
        `    ${row.name.padEnd(28)} ${String(row.count).padStart(8)} docs  billed ${formatBytes(billed).padStart(10)}  (data ${formatBytes(row.size)}, idx ${formatBytes(row.totalIndexSize)})`
      );
    }
  }
  console.log(`\n=== CLUSTER BILLED ESTIMATE === ${formatBytes(clusterBilled)} / 512 MB quota`);
  if (clusterBilled > 512 * 1024 * 1024) {
    console.log('  OVER QUOTA — writes blocked until ~10+ MB freed or tier upgraded.');
  }
}

async function countOlderThan(db, collection, dateField, cutoff) {
  const col = db.collection(collection);
  const exists = (await db.listCollections({ name: collection }).toArray()).length > 0;
  if (!exists) return 0;
  return col.countDocuments({ [dateField]: { $lt: cutoff } });
}

async function runPrunes(client, databases) {
  const cutoff = new Date(Date.now() - pruneDays * 24 * 60 * 60 * 1000);
  const actions = [];

  for (const { dbName } of databases) {
    const db = client.db(dbName);
    const isBackupDb = dbName === (process.env.MONGODB_BACKUP_DB || 'taskmaster_backups');
    const isLocal = dbName === dbNameFromUri(process.env.MONGODB_URI, 'taskmaster_local');

    if (onlyTargets.includes('logs') && !isBackupDb) {
      for (const [col, field] of [
        ['logs', 'createdAt'],
        ['logs', 'timestamp'],
        ['systemlogs', 'createdAt'],
        ['systemlogs', 'timestamp'],
        ['crmaudits', 'timestamp'],
      ]) {
        const count = await countOlderThan(db, col, field, cutoff);
        if (count > 0) {
          actions.push({ dbName, collection: col, filter: { [field]: { $lt: cutoff } }, count });
        }
      }
    }

    if (onlyTargets.includes('mail') && !isBackupDb) {
      for (const [col, field] of [
        ['mailevents', 'timestamp'],
        ['mailevents', 'createdAt'],
        ['emaillogs', 'createdAt'],
        ['emaillogs', 'sentAt'],
      ]) {
        const count = await countOlderThan(db, col, field, cutoff);
        if (count > 0) {
          actions.push({ dbName, collection: col, filter: { [field]: { $lt: cutoff } }, count });
        }
      }
      const mailTestCount = await db.collection('mailevents').countDocuments({ email: { $regex: MAIL_TEST_EMAIL_RE } });
      if (mailTestCount > 0) {
        actions.push({
          dbName,
          collection: 'mailevents',
          filter: { email: { $regex: MAIL_TEST_EMAIL_RE } },
          count: mailTestCount,
          label: 'test-email mailevents',
        });
      }
    }

    if (onlyTargets.includes('qa') && isLocal) {
      const qaFilters = [
        { collection: 'logs', filter: { $or: [{ origin: 'QA_AGENT_TEST' }, { module: 'QA_TESTING' }, { action: 'QA_TEST' }] } },
        { collection: 'qatestruns', filter: { status: { $in: ['completed', 'failed', 'cancelled'] } }, label: 'finished QA runs' },
      ];
      for (const item of qaFilters) {
        const exists = (await db.listCollections({ name: item.collection }).toArray()).length > 0;
        if (!exists) continue;
        const count = await db.collection(item.collection).countDocuments(item.filter);
        if (count > 0) actions.push({ dbName, ...item, count });
      }
    }

    if (onlyTargets.includes('orphans') && isLocal) {
      for (const name of ORPHAN_COLLECTIONS) {
        const exists = (await db.listCollections({ name }).toArray()).length > 0;
        if (!exists) continue;
        const count = await db.collection(name).countDocuments();
        actions.push({ dbName, collection: name, drop: true, count });
      }
    }

    if (onlyTargets.includes('backups') && isBackupDb) {
      const chunkCount = await db.collection('backup_archives.chunks').countDocuments().catch(() => 0);
      const fileCount = await db.collection('backup_archives.files').countDocuments().catch(() => 0);
      if (chunkCount || fileCount) {
        actions.push({
          dbName,
          collection: 'backup_archives.*',
          dropGridFS: true,
          count: fileCount,
          chunkCount,
          label: 'GridFS backup archives (re-run backup:daily after cleanup)',
        });
      }
    }
  }

  console.log('\n--- Planned actions ---');
  if (!actions.length) {
    console.log('  Nothing matched prune rules.');
    return;
  }
  for (const a of actions) {
    const label = a.label || a.collection;
    if (a.drop) {
      console.log(`  DROP ${a.dbName}.${label} (${a.count} docs)`);
    } else if (a.dropGridFS) {
      console.log(`  DROP GridFS ${a.dbName}.backup_archives (${a.count} files, ${a.chunkCount} chunks)`);
    } else {
      console.log(`  DELETE ${a.dbName}.${label}: ${a.count} docs`);
    }
  }

  if (dryRun) {
    console.log('\nDry-run complete. Re-run with --execute to apply.');
    console.log('Note: if Atlas has blocked writes (over quota), deletes fail until tier upgrade or Atlas UI cleanup.');
    return;
  }

  console.log('\n--- Executing ---');
  for (const a of actions) {
    const db = client.db(a.dbName);
    try {
      if (a.drop) {
        await db.dropCollection(a.collection);
        console.log(`  dropped ${a.dbName}.${a.collection}`);
      } else if (a.dropGridFS) {
        await db.dropCollection('backup_archives.chunks');
        await db.dropCollection('backup_archives.files');
        await db.collection('backup_snapshots').deleteMany({});
        console.log(`  dropped backup GridFS in ${a.dbName}`);
      } else {
        const result = await db.collection(a.collection).deleteMany(a.filter);
        console.log(`  deleted ${result.deletedCount} from ${a.dbName}.${a.collection}`);
      }
    } catch (err) {
      console.error(`  FAILED ${a.dbName}.${a.collection}: ${err.message}`);
    }
  }
  console.log('\nDone. Re-run without --execute to verify new sizes.');
  console.log('Tip: Atlas may take minutes to reclaim index space after large deletes.');
}

function resolveDatabases() {
  const localDb = dbNameFromUri(process.env.MONGODB_URI, 'taskmaster_local');
  const prodDb = dbNameFromUri(process.env.MONGODB_URI_PROD, 'taskmaster_production');
  const backupDb = process.env.MONGODB_BACKUP_DB || 'taskmaster_backups';
  const all = [
    { key: 'local', dbName: localDb, uri: process.env.MONGODB_URI },
    { key: 'prod', dbName: prodDb, uri: process.env.MONGODB_URI_PROD },
    { key: 'backups', dbName: backupDb, uri: process.env.MONGODB_URI },
  ];
  if (dbScope === 'all') return all;
  return all.filter((d) => d.key === dbScope);
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set in server/.env');
    process.exit(1);
  }

  const dbs = resolveDatabases();
  const client = new MongoClient(uri);
  await client.connect();

  const report = {
    clusterHost: clusterFromUri(uri),
    databases: [],
  };

  for (const { dbName } of dbs) {
    try {
      report.databases.push(await auditDatabase(client, dbName));
    } catch (err) {
      console.warn(`Skipping ${dbName}: ${err.message}`);
    }
  }

  printAudit(report);
  await runPrunes(client, dbs);
  await client.close();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
