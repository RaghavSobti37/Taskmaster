#!/usr/bin/env node
/**
 * Compare Data Hub + calendar collection counts: local vs production.
 * Usage: node server/scripts/compareDataHubDbs.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

const COLLECTIONS = [
  'contacts',
  'tscdatas',
  'leads',
  'exlybookings',
  'calendarevents',
  'mailevents',
  'datahubsyncstates',
];

function dbNameFromUri(uri, fallback) {
  if (!uri) return fallback;
  const match = uri.match(/mongodb(\+srv)?:\/\/[^/]+\/([^?]+)/i);
  return match && match[2] ? decodeURIComponent(match[2]) : fallback;
}

async function countDb(client, dbName, label) {
  const db = client.db(dbName);
  const counts = { label, dbName };
  for (const col of COLLECTIONS) {
    try {
      counts[col] = await db.collection(col).countDocuments();
    } catch {
      counts[col] = null;
    }
  }
  return counts;
}

async function main() {
  const localUri = process.env.MONGODB_URI;
  const prodUri = process.env.MONGODB_URI_PROD;
  if (!localUri || !prodUri) {
    console.error('Need MONGODB_URI and MONGODB_URI_PROD in server/.env');
    process.exit(1);
  }

  const localDbName = process.env.MONGODB_DB_LOCAL || dbNameFromUri(localUri, 'taskmaster_local');
  const prodDbName = process.env.MONGODB_DB_PROD || dbNameFromUri(prodUri, 'taskmaster_production');

  const localClient = new MongoClient(localUri);
  const prodClient = new MongoClient(prodUri);

  try {
    await localClient.connect();
    await prodClient.connect();
    const local = await countDb(localClient, localDbName, 'local');
    const prod = await countDb(prodClient, prodDbName, 'prod');

    console.log('\nData Hub DB comparison\n');
    console.log('Collection'.padEnd(22), 'Local'.padStart(10), 'Prod'.padStart(10), 'Delta'.padStart(10));
    for (const col of COLLECTIONS) {
      const l = local[col] ?? 0;
      const p = prod[col] ?? 0;
      const delta = l - p;
      console.log(
        col.padEnd(22),
        String(l).padStart(10),
        String(p).padStart(10),
        (delta >= 0 ? `+${delta}` : String(delta)).padStart(10)
      );
    }

    const contactGap = (local.contacts || 0) - (prod.contacts || 0);
    if (contactGap > 100) {
      console.log(
        `\nLocal has ${contactGap} more contacts than prod. Reconcile on prod alone cannot fix this — run:\n` +
          '  node server/scripts/syncDataHubToProd.js --yes\n' +
          '  node server/scripts/seedProductionContent.js'
      );
    }
  } catch (err) {
    console.error('Compare failed:', err.message);
    process.exit(1);
  } finally {
    await localClient.close().catch(() => {});
    await prodClient.close().catch(() => {});
  }
}

main();
