#!/usr/bin/env node
/**
 * Purge CRM / Data Hub collections from LOCAL MongoDB only.
 *
 * Usage:
 *   node server/scripts/purgeLocalCrmDataHub.js --dry-run
 *   node server/scripts/purgeLocalCrmDataHub.js --yes
 *
 * Refuses prod DB names unless SYNC_ALLOW_NON_LOCAL_TARGET=1 (same guard as syncProdToLocal).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { MongoClient } = require('mongodb');
const { getCrmDataHubCollectionNames } = require('../config/syncCollections');

function dbNameFromUri(uri, fallback) {
  if (!uri) return fallback;
  const match = uri.match(/mongodb(\+srv)?:\/\/[^/]+\/([^?]+)/i);
  return (match && match[2]) ? decodeURIComponent(match[2]) : fallback;
}

async function main() {
  const execute = process.argv.includes('--yes') || process.argv.includes('-y');
  const dryRun = !execute || process.argv.includes('--dry-run');

  const localUri = process.env.MONGODB_URI;
  if (!localUri) {
    console.error('Missing MONGODB_URI in server/.env');
    process.exit(1);
  }

  const localDbName = process.env.MONGODB_DB_LOCAL || dbNameFromUri(localUri, 'taskmaster_local');
  if (!localDbName.includes('local') && process.env.SYNC_ALLOW_NON_LOCAL_TARGET !== '1') {
    console.error(
      `Refusing to purge DB "${localDbName}" (expected *local* in name). ` +
        'Set SYNC_ALLOW_NON_LOCAL_TARGET=1 to override.'
    );
    process.exit(1);
  }

  const targets = getCrmDataHubCollectionNames();
  const client = new MongoClient(localUri);

  console.log(dryRun ? 'DRY RUN — pass --yes to drop collections' : 'EXECUTE — dropping CRM/Data Hub collections');
  console.log(`Database: ${localDbName}\n`);

  try {
    await client.connect();
    const db = client.db(localDbName);
    const existing = (await db.listCollections().toArray())
      .map((c) => c.name)
      .filter((n) => !n.startsWith('system.'));

    let totalDocs = 0;
    for (const colName of targets) {
      if (!existing.includes(colName)) {
        console.log(`  ${colName}: (missing)`);
        continue;
      }
      const count = await db.collection(colName).countDocuments();
      totalDocs += count;
      if (execute && !dryRun) {
        await db.collection(colName).drop();
        console.log(`  ${colName}: dropped (${count} docs)`);
      } else {
        console.log(`  ${colName}: ${count} docs (would drop)`);
      }
    }

    console.log(`\nTotal docs in target collections: ${totalDocs}`);
    if (dryRun) {
      console.log('\nRe-run with --yes to apply.');
    } else {
      console.log('\nDone. Set DATA_HUB_RECONCILE_ENABLED=false in server/.env to skip auto-reconcile.');
    }
  } finally {
    await client.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
