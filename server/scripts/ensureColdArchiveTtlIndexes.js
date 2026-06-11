#!/usr/bin/env node
/**
 * Ensure 90-day TTL indexes on Mongo cold-archive collections.
 *
 * Usage:
 *   node scripts/ensureColdArchiveTtlIndexes.js
 *   node scripts/ensureColdArchiveTtlIndexes.js --dry-run
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const { resolveMongoUri } = require('../config/database');
const {
  COLD_ARCHIVE_TTL_SECONDS,
  COLD_ARCHIVE_COLLECTIONS,
} = require('../utils/mongoColdArchiveTtl');

const MODEL_LOADERS = {
  SystemLog: () => require('../models/SystemLog'),
  Log: () => require('../models/Log'),
  CRMAudit: () => require('../models/CRMAudit'),
  MailEvent: () => require('../models/MailEvent'),
  QATestRun: () => require('../models/QATestRun'),
  TaskActivity: () => require('../models/TaskActivity'),
};

async function inspectTtlIndex(collection, field) {
  const indexes = await collection.indexes();
  const ttl = indexes.find(
    (idx) => idx.expireAfterSeconds != null
      && Object.keys(idx.key || {}).includes(field)
  );
  return ttl
    ? { ok: ttl.expireAfterSeconds === COLD_ARCHIVE_TTL_SECONDS, expireAfterSeconds: ttl.expireAfterSeconds }
    : { ok: false, expireAfterSeconds: null };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const report = {
    timestamp: new Date().toISOString(),
    dryRun,
    ttlSecondsExpected: COLD_ARCHIVE_TTL_SECONDS,
    collections: [],
  };

  const { dbUri, source } = resolveMongoUri();
  await mongoose.connect(dbUri, { serverSelectionTimeoutMS: 8000 });
  report.database = mongoose.connection.name;
  report.uriSource = source;

  for (const spec of COLD_ARCHIVE_COLLECTIONS) {
    const loader = MODEL_LOADERS[spec.model];
    if (!loader) {
      report.collections.push({ ...spec, error: 'model loader missing' });
      continue;
    }

    const Model = loader();
    const collection = mongoose.connection.db.collection(spec.collection);

    let before = { ok: false, expireAfterSeconds: null };
    try {
      before = await inspectTtlIndex(collection, spec.field);
    } catch {
      // collection may not exist yet
    }

    if (!dryRun) {
      await Model.syncIndexes();
    }

    const after = await inspectTtlIndex(collection, spec.field);
    report.collections.push({
      ...spec,
      before,
      after,
      synced: !dryRun,
    });
  }

  console.log(JSON.stringify(report, null, 2));

  await mongoose.disconnect();

  const allOk = report.collections.every((c) => c.after?.ok);
  process.exit(allOk ? 0 : 1);
}

main().catch(async (err) => {
  console.error('ensureColdArchiveTtlIndexes failed:', err.message);
  if (mongoose.connection.readyState === 1) await mongoose.disconnect();
  process.exit(1);
});
