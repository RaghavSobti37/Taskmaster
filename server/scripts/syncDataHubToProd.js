#!/usr/bin/env node
/**
 * Push local Data Hub data to production (replaces prod hub collections).
 *
 * Usage:
 *   node server/scripts/compareDataHubDbs.js
 *   node server/scripts/syncDataHubToProd.js --yes
 *   node server/scripts/reconcileDataHub.js --prod --full
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

const BATCH_SIZE = 500;
const COLLECTIONS = [
  'outsourcedrecords',
  'personindexes',
  'personhubviews',
  'people',
  'personidentifiers',
  'personcommunicationprofiles',
  'personsourcelinks',
  'leads',
  'exlybookings',
  'bookedcalls',
  'newslettersubscribers',
  'artistpathresponses',
  'tscdatas',
  'contacts',
  'datahubsyncstates',
];

const INDEX_OPTION_KEYS = new Set([
  'name', 'unique', 'sparse', 'background', 'expireAfterSeconds',
  'partialFilterExpression', 'weights', 'default_language', 'language_override',
  'textIndexVersion', '2dsphereIndexVersion', 'bits', 'min', 'max', 'bucketSize',
  'wildcardProjection', 'hidden', 'collation',
]);

function dbNameFromUri(uri, fallback) {
  if (!uri) return fallback;
  const match = uri.match(/mongodb(\+srv)?:\/\/[^/]+\/([^?]+)/i);
  return match && match[2] ? decodeURIComponent(match[2]) : fallback;
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
  if (total === 0) return { name: colName, count: 0 };

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
    process.env.SYNC_DATA_HUB_TO_PROD_CONFIRM === '1';

  if (!confirmed) {
    console.error(
      'This REPLACES production Data Hub collections with local data.\n' +
        'Run compare first: node server/scripts/compareDataHubDbs.js\n' +
        'Then: node server/scripts/syncDataHubToProd.js --yes\n' +
        'Then: node server/scripts/reconcileDataHub.js --prod --full'
    );
    process.exit(1);
  }

  const localUri = process.env.MONGODB_URI;
  const prodUri = process.env.MONGODB_URI_PROD;
  if (!localUri || !prodUri) {
    console.error('Missing MONGODB_URI or MONGODB_URI_PROD');
    process.exit(1);
  }

  const localDbName = process.env.MONGODB_DB_LOCAL || dbNameFromUri(localUri, 'taskmaster_local');
  const prodDbName = process.env.MONGODB_DB_PROD || dbNameFromUri(prodUri, 'taskmaster_production');

  if (!prodDbName.toLowerCase().includes('prod') && process.env.SYNC_ALLOW_NON_PROD_TARGET !== '1') {
    console.error(`Refusing prod target "${prodDbName}". Set SYNC_ALLOW_NON_PROD_TARGET=1 to override.`);
    process.exit(1);
  }

  const localClient = new MongoClient(localUri);
  const prodClient = new MongoClient(prodUri);
  const summary = [];

  try {
    await localClient.connect();
    await prodClient.connect();
    const localDb = localClient.db(localDbName);
    const prodDb = prodClient.db(prodDbName);

    console.log(`Sync Data Hub: ${localDbName} -> ${prodDbName}`);
    console.log(`Collections: ${COLLECTIONS.join(', ')}\n`);

    for (const name of COLLECTIONS) {
      console.log(`Copy: ${name}`);
      const stats = await copyCollection(localDb.collection(name), prodDb.collection(name));
      summary.push(stats);
    }

    const after = {};
    for (const col of COLLECTIONS) {
      after[col] = await prodDb.collection(col).countDocuments();
    }

    console.log('\nVerification (prod counts):');
    let ok = true;
    for (const row of summary) {
      const prodCount = after[row.name];
      const match = prodCount === row.count;
      console.log(`  ${row.name}: ${prodCount} ${match ? 'OK' : 'MISMATCH'}`);
      if (!match) ok = false;
    }

    if (!ok) process.exit(1);
    console.log('\nDone. Run: node server/scripts/reconcileDataHub.js --prod --full');
  } finally {
    await localClient.close().catch(() => {});
    await prodClient.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
