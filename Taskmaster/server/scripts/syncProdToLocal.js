#!/usr/bin/env node
/**
 * One-shot copy: production MongoDB -> local (READ ONLY on production).
 * WARNING: Replaces ALL collections and data in the local database.
 *
 * From repo root:
 *   node server/scripts/syncProdToLocal.js --yes
 *   node server/scripts/syncProdToLocal.js --yes --mode=operational
 *
 * Modes:
 *   full (default) — all prod collections
 *   operational — users/projects/tasks/workspaces; skips CRM/Data Hub spine
 *
 * Env (server/.env): MONGODB_URI_PROD (source), MONGODB_URI (target).
 * Optional: SYNC_MODE=operational, DATA_HUB_RECONCILE_ENABLED=false after operational sync.
 * Keep MAIL_USE_PROD_DB=false after sync; restart the API server.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { MongoClient } = require('mongodb');
const {
  resolveCollectionsToSync,
  getCrmDataHubCollectionNames,
  parseSyncMode,
  parseExcludeList,
} = require('../config/syncCollections');

const BATCH_SIZE = 500;
const INDEX_OPTION_KEYS = new Set([
  'name',
  'unique',
  'sparse',
  'background',
  'expireAfterSeconds',
  'partialFilterExpression',
  'weights',
  'default_language',
  'language_override',
  'textIndexVersion',
  '2dsphereIndexVersion',
  'bits',
  'min',
  'max',
  'bucketSize',
  'wildcardProjection',
  'hidden',
  'collation',
]);

function dbNameFromUri(uri, fallback) {
  if (!uri) return fallback;
  const match = uri.match(/mongodb(\+srv)?:\/\/[^/]+\/([^?]+)/i);
  return (match && match[2]) ? decodeURIComponent(match[2]) : fallback;
}

function existingLocalHas(localCollections, colName) {
  return localCollections.some((c) => c.name.toLowerCase() === colName.toLowerCase());
}

function indexOptions(indexSpec) {
  const opts = {};
  for (const key of INDEX_OPTION_KEYS) {
    if (indexSpec[key] !== undefined) opts[key] = indexSpec[key];
  }
  if (indexSpec.name) opts.name = indexSpec.name;
  return opts;
}

async function recreateIndexes(sourceCol, targetCol) {
  try {
    const existing = await targetCol.indexes();
    for (const idx of existing) {
      if (idx.name === '_id_') continue;
      await targetCol.dropIndex(idx.name);
    }
  } catch (err) {
    if (err.codeName !== 'NamespaceNotFound') throw err;
  }

  const specs = await sourceCol.indexes();
  for (const spec of specs) {
    if (spec.name === '_id_') continue;
    await targetCol.createIndex(spec.key, indexOptions(spec));
  }
}

async function copyCollection(sourceCol, targetDb, colName) {
  const targetCol = targetDb.collection(colName);
  try {
    await targetCol.drop();
  } catch (err) {
    if (err.codeName !== 'NamespaceNotFound') throw err;
  }
  const freshTarget = targetDb.collection(colName);

  const total = await sourceCol.countDocuments();
  await recreateIndexes(sourceCol, freshTarget);

  if (total === 0) {
    return { name: colName, count: 0 };
  }

  let copied = 0;
  const cursor = sourceCol.find({}).batchSize(BATCH_SIZE);
  let batch = [];

  for await (const doc of cursor) {
    batch.push(doc);
    if (batch.length >= BATCH_SIZE) {
      await freshTarget.insertMany(batch, { ordered: false });
      copied += batch.length;
      batch = [];
      process.stdout.write(`  ${colName}: ${copied}/${total}\r`);
    }
  }
  if (batch.length) {
    await freshTarget.insertMany(batch, { ordered: false });
    copied += batch.length;
  }
  process.stdout.write(`  ${colName}: ${copied}/${total}    \n`);
  return { name: colName, count: copied };
}

async function main() {
  const confirmed =
    process.argv.includes('--yes') ||
    process.argv.includes('-y') ||
    process.env.SYNC_PROD_TO_LOCAL_CONFIRM === '1';

  const syncMode = parseSyncMode();
  const extraExclude = parseExcludeList();

  if (!confirmed) {
    console.error(
      'This OVERWRITES the local MongoDB database with production data (read-only on prod).\n' +
        'Re-run with: node server/scripts/syncProdToLocal.js --yes\n' +
        'Operational (no CRM/Data Hub): node server/scripts/syncProdToLocal.js --yes --mode=operational'
    );
    process.exit(1);
  }

  const prodUri = process.env.MONGODB_URI_PROD;
  const localUri = process.env.MONGODB_URI;
  if (!prodUri || !localUri) {
    console.error('Missing MONGODB_URI_PROD or MONGODB_URI in server/.env');
    process.exit(1);
  }

  const prodDbName = process.env.MONGODB_DB_PROD || dbNameFromUri(prodUri, 'taskmaster_production');
  const localDbName = process.env.MONGODB_DB_LOCAL || dbNameFromUri(localUri, 'taskmaster_local');

  if (!localDbName.includes('local') && process.env.SYNC_ALLOW_NON_LOCAL_TARGET !== '1') {
    console.error(
      `Refusing to write to target DB "${localDbName}" (expected a *local* database name).\n` +
        'Set SYNC_ALLOW_NON_LOCAL_TARGET=1 to override.'
    );
    process.exit(1);
  }

  const prodClient = new MongoClient(prodUri, { readPreference: 'secondaryPreferred' });
  const localClient = new MongoClient(localUri);

  const summary = [];

  try {
    await prodClient.connect();
    await localClient.connect();

    const prodDb = prodClient.db(prodDbName);
    const localDb = localClient.db(localDbName);

    console.log(`Sync (read-only prod): ${prodDbName} -> ${localDbName} [mode=${syncMode}]`);

    const prodCollections = (await prodDb.listCollections().toArray()).filter(
      (c) => !c.name.startsWith('system.')
    );
    const prodNames = new Set(prodCollections.map((c) => c.name));
    const toSync = resolveCollectionsToSync(
      syncMode,
      prodCollections.map((c) => c.name),
      extraExclude
    );
    const toSyncSet = new Set(toSync.map((n) => n.toLowerCase()));

    const localCollections = (await localDb.listCollections().toArray()).filter(
      (c) => !c.name.startsWith('system.')
    );
    for (const lc of localCollections) {
      if (!prodNames.has(lc.name)) {
        console.log(`Drop local-only collection: ${lc.name}`);
        await localDb.collection(lc.name).drop();
      }
    }

    if (syncMode === 'operational') {
      for (const colName of getCrmDataHubCollectionNames()) {
        if (!existingLocalHas(localCollections, colName)) continue;
        console.log(`Purge stale CRM/Data Hub collection: ${colName}`);
        await localDb.collection(colName).drop();
      }
    }

    const skipped = prodCollections
      .map((c) => c.name)
      .filter((n) => !toSyncSet.has(n.toLowerCase()));
    if (skipped.length) {
      console.log(`Skipping ${skipped.length} collection(s): ${skipped.sort().join(', ')}`);
    }

    for (const name of toSync) {
      console.log(`Copy: ${name}`);
      const stats = await copyCollection(prodDb.collection(name), localDb, name);
      summary.push(stats);
    }

    console.log('\nDone. Collection document counts:');
    for (const row of summary.sort((a, b) => a.name.localeCompare(b.name))) {
      console.log(`  ${row.name}: ${row.count}`);
    }
  } finally {
    await prodClient.close().catch(() => {});
    await localClient.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
