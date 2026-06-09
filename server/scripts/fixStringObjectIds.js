/**
 * Fix legacy GridFS backup BSON types (string _id, string refs, string dates).
 *
 *   node scripts/fixStringObjectIds.js --refs-all --apply
 *   node scripts/fixStringObjectIds.js --all --apply
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { getDbNameFromUri, maskMongoUri } = require('../config/database');
const { toObjectId, toDate, isRefField, DATE_FIELDS } = require('../utils/mongoId');

const apply = process.argv.includes('--apply');
const scanAll = process.argv.includes('--all');
const refsAll = process.argv.includes('--refs-all');
const collectionsArg = process.argv.find((arg) => arg.startsWith('--collections='));
const DEFAULT_COLLECTIONS = [
  'tenants', 'departments', 'users', 'workspaces', 'projects', 'tasks',
  'taskassignments', 'leads', 'contacts', 'tscdatas', 'xpauditlogs', 'dailymissions',
  'pinboardnotes', 'notifications', 'datahubsyncstates',
];

async function discoverStringIdCollections(db) {
  const names = (await db.listCollections().toArray())
    .map((c) => c.name)
    .filter((n) => !n.startsWith('system.'));
  const out = [];
  for (const name of names) {
    // eslint-disable-next-line no-await-in-loop
    const count = await db.collection(name).countDocuments({ _id: { $type: 'string' } });
    if (count > 0) out.push({ name, count });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

async function discoverAllCollections(db) {
  return (await db.listCollections().toArray())
    .map((c) => c.name)
    .filter((n) => !n.startsWith('system.'))
    .sort();
}

function refFieldsFromDoc(doc) {
  if (!doc) return [];
  return Object.keys(doc).filter((key) => isRefField(key) && key !== '_id');
}

async function normalizeRefFields(db, name) {
  const col = db.collection(name);
  const sample = await col.findOne({ _id: { $type: 'string' } }) || await col.findOne({});
  const fields = refFieldsFromDoc(sample);
  let updated = 0;
  for (const field of fields) {
    // eslint-disable-next-line no-await-in-loop
    const docs = await col.find({ [field]: { $type: 'string' } }).toArray();
    for (const doc of docs) {
      const next = toObjectId(doc[field]);
      if (!next || String(next) === String(doc[field])) continue;
      if (apply) {
        // eslint-disable-next-line no-await-in-loop
        await col.updateOne({ _id: doc._id }, { $set: { [field]: next } });
      }
      updated += 1;
    }
  }
  if (updated) console.log(`  ${name}: ${apply ? 'updated' : 'would update'} ${updated} ref field(s)`);
  return updated;
}

async function normalizeDateFields(db, name) {
  const col = db.collection(name);
  let updated = 0;
  for (const field of DATE_FIELDS) {
    // eslint-disable-next-line no-await-in-loop
    const docs = await col.find({ [field]: { $type: 'string' } }).toArray();
    for (const doc of docs) {
      const next = toDate(doc[field]);
      if (!next || next === doc[field] || !(next instanceof Date)) continue;
      if (apply) {
        // eslint-disable-next-line no-await-in-loop
        await col.updateOne({ _id: doc._id }, { $set: { [field]: next } });
      }
      updated += 1;
    }
  }
  if (updated) console.log(`  ${name}: ${apply ? 'updated' : 'would update'} ${updated} date field(s)`);
  return updated;
}

async function convertCollectionIds(db, name) {
  const col = db.collection(name);
  const stringDocs = await col.find({ _id: { $type: 'string' } }).toArray();
  if (!stringDocs.length) {
    console.log(`  ${name}: no string _ids`);
    return 0;
  }
  console.log(`  ${name}: ${stringDocs.length} document(s) with string _id`);
  if (!apply) return stringDocs.length;

  const refFields = refFieldsFromDoc(stringDocs[0]);
  let converted = 0;
  let skipped = 0;
  for (const doc of stringDocs) {
    const oldId = doc._id;
    const newId = toObjectId(oldId);
    const next = { ...doc, _id: newId };
    for (const field of refFields) {
      if (next[field]) next[field] = toObjectId(next[field]);
    }
    // eslint-disable-next-line no-await-in-loop
    const existing = await col.findOne({ _id: newId });
    if (existing) {
      // eslint-disable-next-line no-await-in-loop
      await col.deleteOne({ _id: oldId });
      skipped += 1;
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    await col.deleteOne({ _id: oldId });
    try {
      // eslint-disable-next-line no-await-in-loop
      await col.insertOne(next);
      converted += 1;
    } catch (err) {
      if (err?.code === 11000) {
        skipped += 1;
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      await col.insertOne({ ...doc, _id: oldId }).catch(() => {});
      throw err;
    }
    if (converted % 500 === 0) {
      process.stdout.write(`    ${name}: ${converted}/${stringDocs.length}\r`);
    }
  }
  if (converted >= 500) process.stdout.write('\n');
  if (skipped) console.log(`  ${name}: skipped ${skipped} legacy row(s)`);
  return converted + skipped;
}

async function main() {
  const uri = (process.env.MONGODB_URI || '').trim();
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });
  const db = mongoose.connection.db;

  let collections = collectionsArg
    ? collectionsArg.slice('--collections='.length).split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_COLLECTIONS;

  if (refsAll) {
    collections = await discoverAllCollections(db);
    console.log(`--refs-all: ${collections.length} collection(s)\n`);
  } else if (scanAll) {
    const discovered = await discoverStringIdCollections(db);
    collections = discovered.map((row) => row.name);
    console.log(`Discovered ${discovered.length} collection(s) with string _ids`);
    for (const row of discovered) console.log(`  ${row.name}: ${row.count}`);
    console.log('');
  }

  console.log(`Target: ${maskMongoUri(uri)} / ${getDbNameFromUri(uri) || 'unknown'}`);
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'}\n`);

  for (const name of collections) {
    console.log(name);
    // eslint-disable-next-line no-await-in-loop
    await normalizeRefFields(db, name);
    // eslint-disable-next-line no-await-in-loop
    await normalizeDateFields(db, name);
    if (!refsAll) {
      // eslint-disable-next-line no-await-in-loop
      await convertCollectionIds(db, name);
    }
  }

  await mongoose.disconnect();
  console.log(`\nDone${apply ? '' : ' (dry run)'}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
