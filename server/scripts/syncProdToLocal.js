#!/usr/bin/env node
/**
 * One-shot copy: production MongoDB -> local (READ ONLY on production).
 * WARNING: Replaces ALL collections and data in the local database.
 *
 * From repo root:
 *   node server/scripts/syncProdToLocal.js --yes
 *
 * Env (server/.env): MONGODB_URI_PROD (source), MONGODB_URI (target).
 * Keep MAIL_USE_PROD_DB=false after sync; restart the API server.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

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

function indexOptions(indexSpec) {
  const opts = {};
  for (const key of INDEX_OPTION_KEYS) {
    if (indexSpec[key] !== undefined) opts[key] = indexSpec[key];
  }
  if (indexSpec.name) opts.name = indexSpec.name;
  return opts;
}

async function recreateIndexes(sourceCol, targetCol) {
  const specs = await sourceCol.indexes();
  for (const spec of specs) {
    if (spec.name === '_id_') continue;
    await targetCol.createIndex(spec.key, indexOptions(spec));
  }
}

async function copyCollection(sourceCol, targetCol) {
  const colName = sourceCol.collectionName;
  await targetCol.deleteMany({});

  const total = await sourceCol.countDocuments();
  await recreateIndexes(sourceCol, targetCol);

  if (total === 0) {
    return { name: colName, count: 0 };
  }

  let copied = 0;
  const cursor = sourceCol.find({}).batchSize(BATCH_SIZE);
  let batch = [];

  for await (const doc of cursor) {
    batch.push(doc);
    if (batch.length >= BATCH_SIZE) {
      await targetCol.insertMany(batch, { ordered: false });
      copied += batch.length;
      batch = [];
      process.stdout.write(`  ${colName}: ${copied}/${total}\r`);
    }
  }
  if (batch.length) {
    await targetCol.insertMany(batch, { ordered: false });
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

  if (!confirmed) {
    console.error(
      'This OVERWRITES the local MongoDB database with production data (read-only on prod).\n' +
        'Re-run with: node server/scripts/syncProdToLocal.js --yes'
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

    console.log(`Sync (read-only prod): ${prodDbName} -> ${localDbName}`);

    const prodCollections = (await prodDb.listCollections().toArray()).filter(
      (c) => !c.name.startsWith('system.')
    );
    const prodNames = new Set(prodCollections.map((c) => c.name));

    const localCollections = (await localDb.listCollections().toArray()).filter(
      (c) => !c.name.startsWith('system.')
    );
    for (const lc of localCollections) {
      if (!prodNames.has(lc.name)) {
        console.log(`Drop local-only collection: ${lc.name}`);
        await localDb.collection(lc.name).drop();
      }
    }

    for (const { name } of prodCollections) {
      console.log(`Copy: ${name}`);
      const stats = await copyCollection(prodDb.collection(name), localDb.collection(name));
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
