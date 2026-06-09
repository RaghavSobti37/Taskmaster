#!/usr/bin/env node
/**
 * Mass-push Data Hub collections local → production (raw Mongo copy, no per-record merge).
 *
 * Fast path: derived hub collections only (~30s). Source data on prod already matches local.
 *
 * Usage:
 *   node server/scripts/compareDataHubDbs.js
 *   node server/scripts/syncDataHubToProd.js --yes              # hub read-models only (default)
 *   node server/scripts/syncDataHubToProd.js --yes --full       # all inlet + hub collections
 *
 * Env: MONGODB_URI (local), MONGODB_URI_PROD (production)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

/** Person spine + hub views — push when prod counts/UI are wrong but source inlets already match */
const HUB_COLLECTIONS = [
  'people',
  'personidentifiers',
  'personcommunicationprofiles',
  'personsourcelinks',
  'personindexes',
  'personhubviews',
  'datahubsyncstates',
];

/** Raw inlet collections — only when prod is missing source rows */
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

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizePhone(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function dedupeHubViews(docs) {
  const seenPersonId = new Set();
  const seenEmail = new Set();
  const seenPhone = new Set();
  const sorted = [...docs].sort((a, b) => {
    const inletDelta = (b.inletCount || 0) - (a.inletCount || 0);
    if (inletDelta !== 0) return inletDelta;
    return new Date(b.lastActivityAt || b.updatedAt || 0) - new Date(a.lastActivityAt || a.updatedAt || 0);
  });
  const kept = [];
  for (const doc of sorted) {
    const personId = doc.personId ? String(doc.personId) : '';
    const email = normalizeEmail(doc.email);
    const phone = normalizePhone(doc.phone);
    if (personId && seenPersonId.has(personId)) continue;
    if (email && seenEmail.has(email)) continue;
    if (phone && seenPhone.has(phone)) continue;
    if (personId) seenPersonId.add(personId);
    if (email) seenEmail.add(email);
    if (phone) seenPhone.add(phone);
    kept.push({
      ...doc,
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
    });
  }
  const dropped = docs.length - kept.length;
  if (dropped > 0) {
    console.log(`  personhubviews: deduped ${dropped} rows (personId/email/phone unique)`);
  }
  return kept;
}

function dedupePersonIdentifiers(docs) {
  const seen = new Set();
  const kept = [];
  for (const doc of docs) {
    const value = doc.type === 'email'
      ? normalizeEmail(doc.valueNormalized)
      : normalizePhone(doc.valueNormalized);
    const key = `${doc.type}:${value}`;
    if (!value || seen.has(key)) continue;
    seen.add(key);
    kept.push({ ...doc, valueNormalized: value });
  }
  const dropped = docs.length - kept.length;
  if (dropped > 0) {
    console.log(`  personidentifiers: deduped ${dropped} rows`);
  }
  return kept;
}

function dedupeByPersonId(docs, label) {
  const byPerson = new Map();
  for (const doc of docs) {
    const personId = doc.personId ? String(doc.personId) : '';
    if (!personId) {
      byPerson.set(`orphan:${byPerson.size}`, doc);
      continue;
    }
    if (!byPerson.has(personId)) byPerson.set(personId, doc);
  }
  const kept = [...byPerson.values()];
  const dropped = docs.length - kept.length;
  if (dropped > 0) {
    console.log(`  ${label}: deduped ${dropped} rows (one per personId)`);
  }
  return kept;
}

const COLLECTION_PREP = {
  personhubviews: dedupeHubViews,
  personidentifiers: dedupePersonIdentifiers,
  personcommunicationprofiles: (docs) => dedupeByPersonId(docs, 'personcommunicationprofiles'),
};

function indexOptions(indexSpec) {
  const opts = {};
  for (const key of INDEX_OPTION_KEYS) {
    if (indexSpec[key] !== undefined) opts[key] = indexSpec[key];
  }
  if (indexSpec.name) opts.name = indexSpec.name;
  return opts;
}

/**
 * One read + one write per collection. No per-document merge logic.
 * MongoDB insertMany still chunks internally at ~16MB BSON — that is driver-level only.
 */
async function massCopyCollection(sourceCol, targetCol) {
  const colName = sourceCol.collectionName;
  const started = Date.now();

  const [rawDocs, indexSpecs] = await Promise.all([
    sourceCol.find({}).toArray(),
    sourceCol.indexes(),
  ]);
  const prep = COLLECTION_PREP[colName];
  const docs = prep ? prep(rawDocs) : rawDocs;

  try {
    await targetCol.drop();
  } catch (err) {
    if (err.codeName !== 'NamespaceNotFound') throw err;
  }

  if (!docs.length) {
    return { name: colName, count: 0, ms: Date.now() - started };
  }

  await targetCol.insertMany(docs, { ordered: false });

  const insertedCount = await targetCol.countDocuments();

  for (const spec of indexSpecs) {
    if (spec.name === '_id_') continue;
    try {
      await targetCol.createIndex(spec.key, indexOptions(spec));
    } catch (err) {
      if (err.code === 11000) {
        console.warn(`  ${colName}: index ${spec.name} skipped (${err.message})`);
      } else {
        throw err;
      }
    }
  }

  const ms = Date.now() - started;
  console.log(`  ${colName}: ${docs.length} docs in ${(ms / 1000).toFixed(1)}s`);
  return { name: colName, count: docs.length, insertedCount, ms };
}

async function massCopyAll(localDb, prodDb, collectionNames) {
  const started = Date.now();
  console.log(`Mass copy ${collectionNames.length} collections (sequential — avoids prod auto-sync races)…\n`);

  const results = [];
  for (const name of collectionNames) {
    results.push(await massCopyCollection(
      localDb.collection(name),
      prodDb.collection(name),
    ));
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\nFinished ${collectionNames.length} collections in ${elapsed}s`);
  return results;
}

async function main() {
  const confirmed =
    process.argv.includes('--yes') ||
    process.argv.includes('-y') ||
    process.env.SYNC_DATA_HUB_TO_PROD_CONFIRM === '1';

  const full = process.argv.includes('--full');
  const collections = full
    ? [...SOURCE_COLLECTIONS, ...HUB_COLLECTIONS]
    : HUB_COLLECTIONS;

  if (!confirmed) {
    console.error(
      'Mass-push local Data Hub → production (replaces listed collections).\n\n' +
        '  npm run datahub:compare\n' +
        '  npm run datahub:push-prod           # hub read-models (~2 min)\n' +
        '  npm run datahub:push-prod:full      # all inlets + hub\n\n' +
        'Stop any running reconcileDataHub --prod first.\n' +
        `Default copies: ${HUB_COLLECTIONS.join(', ')}\n` +
        'Raw Mongo copy — no per-record merge.'
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

  if (!prodDbName.toLowerCase().includes('prod') && process.env.SYNC_ALLOW_NON_PROD_TARGET !== '1') {
    console.error(`Refusing prod target "${prodDbName}". Set SYNC_ALLOW_NON_PROD_TARGET=1 to override.`);
    process.exit(1);
  }

  const localClient = new MongoClient(localUri);
  const prodClient = new MongoClient(prodUri);

  try {
    await localClient.connect();
    await prodClient.connect();
    const localDb = localClient.db(localDbName);
    const prodDb = prodClient.db(prodDbName);

    console.log(`Mass push: ${localDbName} → ${prodDbName}`);
    console.log(`Mode: ${full ? 'FULL (sources + hub)' : 'HUB ONLY (read models)'}\n`);

    const summary = await massCopyAll(localDb, prodDb, collections);

    console.log('\nVerification (prod counts vs inserted):');
    let ok = true;
    for (const row of summary) {
      const prodCount = await prodDb.collection(row.name).countDocuments();
      const expected = row.insertedCount ?? row.count;
      const drift = prodCount - expected;
      const match = prodCount === expected;
      const driftNote = drift !== 0 ? ` (+${drift} from live prod API during push — OK if small)` : '';
      console.log(`  ${row.name}: ${prodCount} ${match ? 'OK' : `expected ${expected}${driftNote}`}`);
      if (!match && Math.abs(drift) > 50) ok = false;
    }

    if (!ok) {
      console.log('\nLarge drift — prod API may still be auto-syncing. Pause Render or retry.');
      process.exit(1);
    }
    console.log('\nDone. Hard-refresh production Data Hub / Emails page.');
  } finally {
    await localClient.close().catch(() => {});
    await prodClient.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
