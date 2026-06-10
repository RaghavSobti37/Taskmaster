#!/usr/bin/env node
/**
 * One-time purge for collections no longer persisted server-side.
 *
 * Usage:
 *   node scripts/purgeLocalOnlyCollections.js --dry-run
 *   node scripts/purgeLocalOnlyCollections.js --execute
 *   node scripts/purgeLocalOnlyCollections.js --execute --only=systemlogs,notifications
 *   node scripts/purgeLocalOnlyCollections.js --execute --db=local|prod|all
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

const COLLECTIONS = {
  systemlogs: 'systemlogs',
  notifications: 'notifications',
};

const args = process.argv.slice(2);
const execute = args.includes('--execute');
const dryRun = !execute || args.includes('--dry-run');
const onlyArg = args.find((a) => a.startsWith('--only='));
const targets = onlyArg
  ? onlyArg.split('=')[1].split(',').map((s) => s.trim().toLowerCase())
  : Object.keys(COLLECTIONS);
const dbArg = args.find((a) => a.startsWith('--db='));
const dbScope = dbArg ? dbArg.split('=')[1].toLowerCase() : 'all';

function dbNameFromUri(uri, fallback) {
  if (!uri) return fallback;
  const match = uri.match(/mongodb(\+srv)?:\/\/[^/]+\/([^?]+)/i);
  return match && match[2] ? decodeURIComponent(match[2]) : fallback;
}

async function purgeDb(client, dbName, label) {
  const db = client.db(dbName);
  const results = [];

  for (const key of targets) {
    const collName = COLLECTIONS[key];
    if (!collName) {
      console.warn(`Unknown target: ${key}`);
      continue;
    }
    const count = await db.collection(collName).countDocuments();
    results.push({ db: label, collection: collName, count });
    if (execute && count > 0) {
      const del = await db.collection(collName).deleteMany({});
      results[results.length - 1].deleted = del.deletedCount;
    }
  }

  return results;
}

async function main() {
  const uris = [];
  if (dbScope === 'all' || dbScope === 'local') {
    if (process.env.MONGODB_URI) uris.push({ uri: process.env.MONGODB_URI, label: 'local' });
  }
  if (dbScope === 'all' || dbScope === 'prod') {
    if (process.env.MONGODB_URI_PROD) uris.push({ uri: process.env.MONGODB_URI_PROD, label: 'prod' });
  }

  if (!uris.length) {
    console.error('No MongoDB URI configured for selected --db scope');
    process.exit(1);
  }

  console.log(dryRun ? 'DRY RUN — pass --execute to delete' : 'EXECUTE — deleting documents');
  console.log(`Targets: ${targets.join(', ')}`);

  for (const { uri, label } of uris) {
    const client = new MongoClient(uri);
    await client.connect();
    const dbName = dbNameFromUri(uri, 'test');
    console.log(`\n=== ${label} (${dbName}) ===`);
    const results = await purgeDb(client, dbName, label);
    for (const row of results) {
      const action = execute ? `deleted ${row.deleted ?? 0}` : 'would delete';
      console.log(`  ${row.collection}: ${row.count} docs (${action})`);
    }
    await client.close();
  }

  if (dryRun) {
    console.log('\nRe-run with --execute to apply deletions.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
