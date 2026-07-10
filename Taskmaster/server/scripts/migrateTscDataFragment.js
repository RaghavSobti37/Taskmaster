/**
 * Classify and migrate tscdatas rows into OutsourcedRecord, BookedCall, NewsletterSubscriber.
 * Run: node server/scripts/migrateTscDataFragment.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { classifySourceRow, SOURCE_MODELS } = require('../../shared/sourceClassifier');

const BATCH = 500;

function mapOutsourced(row) {
  return {
    name: row.name,
    nameKey: row.nameKey,
    email: row.email,
    phone: row.phone,
    city: row.city,
    state: row.state,
    role: row.role,
    campaign: row.campaign,
    originSource: row.originSource,
    destination: row.destination,
    dataType: row.dataType,
    sourceFilename: row.sourceFilename,
    importId: row.importId,
    metadata: row.metadata,
    tags: row.tags,
    emailStatus: row.emailStatus,
    tenantId: row.tenantId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    _legacyTscId: row._id,
  };
}

function mapBookedCall(row) {
  const bookedAt = row.timestamp ? new Date(row.timestamp) : row.createdAt;
  return {
    name: row.name,
    nameKey: row.nameKey,
    email: row.email,
    phone: row.phone,
    city: row.city,
    bookedAt: Number.isNaN(bookedAt?.getTime()) ? row.createdAt : bookedAt,
    source: row.originSource || row.campaign || row.dataType,
    importId: row.importId,
    metadata: row.metadata,
    emailStatus: row.emailStatus,
    tenantId: row.tenantId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    _legacyTscId: row._id,
  };
}

function mapNewsletter(row) {
  return {
    name: row.name,
    nameKey: row.nameKey,
    email: row.email,
    phone: row.phone,
    city: row.city,
    subscribedAt: row.createdAt,
    source: row.originSource || row.campaign || row.sourceFilename,
    unsubscribed: row.emailStatus === 'Unsubscribed',
    importId: row.importId,
    metadata: row.metadata,
    emailStatus: row.emailStatus,
    tenantId: row.tenantId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    _legacyTscId: row._id,
  };
}

async function bulkUpsert(collection, docs, keyFields) {
  if (!docs.length) return 0;
  const ops = docs.map((doc) => {
    const filter = {};
    for (const f of keyFields) {
      if (doc[f]) filter[f] = doc[f];
    }
    if (!Object.keys(filter).length) {
      return { insertOne: { document: doc } };
    }
    return {
      updateOne: {
        filter,
        update: { $set: doc },
        upsert: true,
      },
    };
  });
  const result = await collection.bulkWrite(ops, { ordered: false });
  return (result.upsertedCount || 0) + (result.modifiedCount || 0);
}

async function main({ embedded = false } = {}) {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!embedded) {
    if (!uri) {
      console.error('MONGODB_URI not set');
      process.exit(1);
    }
    await mongoose.connect(uri);
  }
  const db = mongoose.connection.db;

  const tsc = db.collection('tscdatas');
  const outsourced = db.collection('outsourcedrecords');
  const booked = db.collection('bookedcalls');
  const newsletter = db.collection('newslettersubscribers');

  const total = await tsc.countDocuments();
  if (total === 0) {
    console.log('no tscdatas rows');
    if (!embedded) await mongoose.disconnect();
    return;
  }

  const counts = { outsourced: 0, booked_call: 0, newsletter: 0 };
  let processed = 0;
  let skip = 0;

  while (skip < total) {
    const batch = await tsc.find({}).skip(skip).limit(BATCH).toArray();
    if (!batch.length) break;

    const buckets = {
      [SOURCE_MODELS.OUTSOURCED]: [],
      [SOURCE_MODELS.BOOKED_CALL]: [],
      [SOURCE_MODELS.NEWSLETTER]: [],
    };

    for (const row of batch) {
      const kind = classifySourceRow(row);
      counts[kind]++;
      if (kind === SOURCE_MODELS.BOOKED_CALL) buckets[kind].push(mapBookedCall(row));
      else if (kind === SOURCE_MODELS.NEWSLETTER) buckets[kind].push(mapNewsletter(row));
      else buckets[kind].push(mapOutsourced(row));
    }

    await bulkUpsert(outsourced, buckets[SOURCE_MODELS.OUTSOURCED], ['email', 'phone']);
    await bulkUpsert(booked, buckets[SOURCE_MODELS.BOOKED_CALL], ['email', 'phone', 'bookedAt']);
    await bulkUpsert(newsletter, buckets[SOURCE_MODELS.NEWSLETTER], ['email']);

    processed += batch.length;
    skip += BATCH;
    console.log(`processed ${processed}/${total}`);
  }

  console.log('classification:', counts);
  console.log('done — tscdatas kept read-only for rollback');
  if (!embedded) await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main };
