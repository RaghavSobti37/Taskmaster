#!/usr/bin/env node
/**
 * Ensure performance compound indexes on hot collections.
 *
 * Usage:
 *   node scripts/ensureIndexes.js
 *   node scripts/ensureIndexes.js --dry-run
 *
 * Also runs once after Mongo connects at server startup (see startServer.js).
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const { resolveMongoUri, getMongooseConnectOptions } = require('../config/database');

const MODEL_LOADERS = [
  () => require('../domains/tasks/models/Task'),
  () => require('../domains/crm/models/Lead'),
  () => require('../models/Attendance'),
  () => require('../models/Log'),
  () => require('../domains/mail/models/MailEvent'),
  () => require('../domains/mail/models/Campaign'),
  () => require('../domains/mail/models/EmailProfile'),
];

/** MailEvent schema is LOCKED — add performance indexes here only. */
const MAIL_EVENT_SCRIPT_INDEXES = [
  { key: { email: 1, timestamp: -1 }, name: 'perf_email_timestamp' },
  { key: { tenantId: 1, timestamp: -1 }, name: 'perf_tenant_timestamp', sparse: true },
];

async function indexExists(collection, name) {
  const indexes = await collection.indexes();
  return indexes.some((idx) => idx.name === name);
}

async function ensureMailEventScriptIndexes(db, dryRun) {
  const collection = db.collection('mailevents');
  const results = [];

  for (const spec of MAIL_EVENT_SCRIPT_INDEXES) {
    const { key, name, ...options } = spec;
    const exists = await indexExists(collection, name);
    if (!dryRun && !exists) {
      await collection.createIndex(key, { name, background: true, ...options });
    }
    results.push({ collection: 'mailevents', name, key, existed: exists, created: !dryRun && !exists });
  }

  return results;
}

async function ensurePerformanceIndexes(options = {}) {
  const dryRun = Boolean(options.dryRun);
  const connection = options.connection || mongoose.connection;

  if (connection.readyState !== 1) {
    throw new Error('MongoDB not connected — cannot ensure indexes');
  }

  const report = {
    timestamp: new Date().toISOString(),
    dryRun,
    database: connection.name,
    models: [],
    mailEvent: [],
  };

  for (const load of MODEL_LOADERS) {
    const Model = load();
    const modelName = Model.modelName;
    if (!dryRun) {
      await Model.syncIndexes();
    }
    report.models.push({ model: modelName, synced: !dryRun });
  }

  report.mailEvent = await ensureMailEventScriptIndexes(connection.db, dryRun);
  return report;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const { dbUri, source } = resolveMongoUri();

  await mongoose.connect(dbUri, getMongooseConnectOptions());
  const report = await ensurePerformanceIndexes({ dryRun, connection: mongoose.connection });
  report.uriSource = source;

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  process.exit(0);
}

if (require.main === module) {
  main().catch(async (err) => {
    console.error('ensureIndexes failed:', err.message);
    if (mongoose.connection.readyState === 1) await mongoose.disconnect();
    process.exit(1);
  });
}

module.exports = { ensurePerformanceIndexes, MAIL_EVENT_SCRIPT_INDEXES };
