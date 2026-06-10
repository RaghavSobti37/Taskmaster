#!/usr/bin/env node
/**
 * Replace production email campaign data with local dev campaign data.
 *
 * Copies raw Mongo documents (preserves _id, embedded recipients, tenantId).
 * Does NOT touch tracking/geo logic — data migration only.
 *
 * Collections (default):
 *   campaigns, mailcampaigns, mailevents, emaillogs
 *
 * Optional (--with-templates):
 *   mailtemplates
 *
 * Usage (from repo root):
 *   node server/scripts/syncEmailCampaignsToProd.js --dry-run
 *   node server/scripts/syncEmailCampaignsToProd.js --yes
 *   node server/scripts/syncEmailCampaignsToProd.js --yes --with-templates
 *
 * Env (server/.env):
 *   MONGODB_URI          — local source
 *   MONGODB_URI_PROD     — production target
 *   MONGODB_DB_LOCAL     — default: taskmaster_local
 *   MONGODB_DB_PROD      — default: taskmaster_production
 *
 * Safety:
 *   Prod writes require --yes OR SYNC_EMAIL_CAMPAIGNS_TO_PROD_CONFIRM=1
 *   Prod DB name must include "prod" unless SYNC_ALLOW_NON_PROD_TARGET=1
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

const CORE_COLLECTIONS = ['campaigns', 'mailcampaigns', 'mailevents', 'emaillogs'];
const OPTIONAL_COLLECTIONS = ['mailtemplates'];

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

async function sampleTitles(db, colName, limit = 5) {
  const col = db.collection(colName);
  const exists = (await col.countDocuments({}, { limit: 1 })) > 0;
  if (!exists) return [];

  if (colName === 'campaigns' || colName === 'mailcampaigns') {
    return col
      .find({}, { projection: { title: 1, status: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }
  if (colName === 'mailevents') {
    return col
      .aggregate([
        { $group: { _id: '$eventType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();
  }
  return [];
}

async function summarizeCollection(localDb, prodDb, colName) {
  const localCol = localDb.collection(colName);
  const prodCol = prodDb.collection(colName);
  const [localCount, prodBefore] = await Promise.all([
    localCol.countDocuments(),
    prodCol.countDocuments(),
  ]);
  const [localSamples, prodSamples] = await Promise.all([
    sampleTitles(localDb, colName),
    sampleTitles(prodDb, colName),
  ]);
  return { name: colName, localCount, prodBefore, prodAfter: localCount, localSamples, prodSamples };
}

async function recreateIndexes(sourceCol, targetCol) {
  const specs = await sourceCol.indexes();
  for (const spec of specs) {
    if (spec.name === '_id_') continue;
    try {
      await targetCol.createIndex(spec.key, indexOptions(spec));
    } catch (err) {
      if (err.code === 11000) {
        console.warn(`  ${targetCol.collectionName}: index ${spec.name} skipped (${err.message})`);
      } else {
        throw err;
      }
    }
  }
}

async function replaceCollection(localCol, prodCol, { dryRun }) {
  const colName = localCol.collectionName;
  const docs = await localCol.find({}).toArray();
  const prodBefore = await prodCol.countDocuments();

  if (dryRun) {
    return {
      name: colName,
      localCount: docs.length,
      prodBefore,
      prodAfter: docs.length,
      dryRun: true,
    };
  }

  try {
    await prodCol.drop();
  } catch (err) {
    if (err.codeName !== 'NamespaceNotFound') throw err;
  }

  if (docs.length) {
    await prodCol.insertMany(docs, { ordered: false });
  }

  await recreateIndexes(localCol, prodCol);

  const prodAfter = await prodCol.countDocuments();
  return {
    name: colName,
    localCount: docs.length,
    prodBefore,
    prodAfter,
    dryRun: false,
  };
}

function printSummary(rows, { dryRun, localDbName, prodDbName }) {
  console.log(`\n${dryRun ? 'Dry-run' : 'Applied'}: ${localDbName} → ${prodDbName}\n`);
  for (const row of rows) {
    console.log(`  ${row.name}:`);
    console.log(`    local: ${row.localCount}`);
    console.log(`    prod before: ${row.prodBefore}`);
    console.log(`    prod after: ${dryRun ? `(would be ${row.localCount})` : row.prodAfter}`);
    if (row.localSamples?.length) {
      console.log(`    local sample: ${JSON.stringify(row.localSamples)}`);
    }
    if (row.prodSamples?.length) {
      console.log(`    prod sample: ${JSON.stringify(row.prodSamples)}`);
    }
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const withTemplates = process.argv.includes('--with-templates');
  const confirmed =
    process.argv.includes('--yes') ||
    process.argv.includes('-y') ||
    process.env.SYNC_EMAIL_CAMPAIGNS_TO_PROD_CONFIRM === '1';

  const collections = withTemplates
    ? [...CORE_COLLECTIONS, ...OPTIONAL_COLLECTIONS]
    : CORE_COLLECTIONS;

  if (!dryRun && !confirmed) {
    console.error(
      'Replaces production email campaign collections with local data.\n\n' +
        '  node server/scripts/syncEmailCampaignsToProd.js --dry-run\n' +
        '  node server/scripts/syncEmailCampaignsToProd.js --yes\n' +
        '  node server/scripts/syncEmailCampaignsToProd.js --yes --with-templates\n\n' +
        `Collections: ${collections.join(', ')}\n` +
        'Pause Render API during push to avoid live writes racing the sync.\n' +
        'Raw copy — local _id / tenantId / leadId refs preserved (may not match prod CRM users).'
    );
    process.exit(1);
  }

  const localUri = process.env.MONGODB_URI;
  const prodUri = process.env.MONGODB_URI_PROD;
  if (!localUri || !prodUri) {
    console.error('Missing MONGODB_URI or MONGODB_URI_PROD in server/.env');
    process.exit(1);
  }

  const localDbName = process.env.MONGODB_DB_LOCAL || dbNameFromUri(localUri, 'taskmaster_local');
  const prodDbName = process.env.MONGODB_DB_PROD || dbNameFromUri(prodUri, 'taskmaster_production');

  if (!localDbName.toLowerCase().includes('local') && process.env.SYNC_ALLOW_NON_LOCAL_SOURCE !== '1') {
    console.error(
      `Refusing local source "${localDbName}" (expected *local* in name). ` +
        'Set SYNC_ALLOW_NON_LOCAL_SOURCE=1 to override.'
    );
    process.exit(1);
  }

  if (!dryRun && !prodDbName.toLowerCase().includes('prod') && process.env.SYNC_ALLOW_NON_PROD_TARGET !== '1') {
    console.error(
      `Refusing prod target "${prodDbName}". Set SYNC_ALLOW_NON_PROD_TARGET=1 to override.`
    );
    process.exit(1);
  }

  const localClient = new MongoClient(localUri);
  const prodClient = new MongoClient(prodUri);

  try {
    await localClient.connect();
    await prodClient.connect();

    const localDb = localClient.db(localDbName);
    const prodDb = prodClient.db(prodDbName);

    console.log(`Email campaign sync${dryRun ? ' (dry-run)' : ''}`);
    console.log(`Source: ${localDbName}`);
    console.log(`Target: ${prodDbName}`);
    console.log(`Collections: ${collections.join(', ')}\n`);

    const previews = [];
    for (const name of collections) {
      previews.push(await summarizeCollection(localDb, prodDb, name));
    }

    printSummary(previews, { dryRun, localDbName, prodDbName });

    if (dryRun) {
      console.log('\nNo writes performed. Re-run with --yes to apply.');
      return;
    }

    console.log('\nApplying replace (drop prod collection → insert local docs)…\n');
    const results = [];
    for (const name of collections) {
      console.log(`Copy: ${name}`);
      results.push(
        await replaceCollection(localDb.collection(name), prodDb.collection(name), { dryRun: false }),
      );
    }

    console.log('\nVerification:');
    let ok = true;
    for (const row of results) {
      const match = row.prodAfter === row.localCount;
      console.log(
        `  ${row.name}: prod=${row.prodAfter} local=${row.localCount} ${match ? 'OK' : 'MISMATCH'}`,
      );
      if (!match) ok = false;
    }

    if (!ok) process.exit(1);
    console.log('\nDone. Hard-refresh production Emails / Campaign pages.');
  } finally {
    await localClient.close().catch(() => {});
    await prodClient.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
