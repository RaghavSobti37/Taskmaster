require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

const HUB_COLLECTIONS = [
  'people',
  'personidentifiers',
  'personcommunicationprofiles',
  'personsourcelinks',
  'personindexes',
  'personhubviews',
  'datahubsyncstates',
];

const SOURCE_COLLECTIONS = [
  'outsourcedrecords',
  'leads',
  'exlybookings',
  'bookedcalls',
  'newslettersubscribers',
  'artistpathresponses',
  'tscdatas',
  'contacts',
];

const COLLECTIONS = [...SOURCE_COLLECTIONS, ...HUB_COLLECTIONS];

function dbNameFromUri(uri, fallback) {
  if (!uri) return fallback;
  const match = uri.match(/mongodb(\+srv)?:\/\/[^/]+\/([^?]+)/i);
  return match && match[2] ? decodeURIComponent(match[2]) : fallback;
}

async function countDb(client, dbName) {
  const db = client.db(dbName);
  const counts = {};
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
    console.error('Need MONGODB_URI and MONGODB_URI_PROD');
    process.exit(1);
  }

  const localDbName = process.env.MONGODB_DB_LOCAL || dbNameFromUri(localUri, 'taskmaster_local');
  const prodDbName = process.env.MONGODB_DB_PROD || dbNameFromUri(prodUri, 'taskmaster_production');

  const localClient = new MongoClient(localUri);
  const prodClient = new MongoClient(prodUri);

  try {
    await localClient.connect();
    await prodClient.connect();
    const local = await countDb(localClient, localDbName);
    const prod = await countDb(prodClient, prodDbName);

    console.log('\nData Hub collection comparison (local vs prod)\n');
    console.log('Collection'.padEnd(24), 'Local'.padStart(10), 'Prod'.padStart(10), 'Delta'.padStart(10));
    for (const col of COLLECTIONS) {
      const l = local[col] ?? 0;
      const p = prod[col] ?? 0;
      const delta = l - p;
      console.log(
        col.padEnd(24),
        String(l).padStart(10),
        String(p).padStart(10),
        (delta >= 0 ? `+${delta}` : String(delta)).padStart(10)
      );
    }

    const hubGap = (local.personhubviews || 0) - (prod.personhubviews || 0);
    if (hubGap > 100) {
      console.log(
        `\nProd hub views behind by ${hubGap}. Mass-push (seconds, no merge):\n` +
          '  npm run datahub:push-prod'
      );
    }
    const sourceGap = (local.outsourcedrecords || 0) - (prod.outsourcedrecords || 0);
    if (sourceGap > 100) {
      console.log(
        `\nProd source rows behind by ${sourceGap}. Full mass-push:\n` +
          '  npm run datahub:push-prod:full'
      );
    }
  } finally {
    await localClient.close().catch(() => {});
    await prodClient.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
