#!/usr/bin/env node
/**
 * Audit Mongo vs Supabase topology and local-only notification posture.
 *
 * Usage:
 *   node scripts/auditDataTopology.js
 *   node scripts/auditDataTopology.js --purge-dry-run
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const { resolveMongoUri } = require('../config/database');
const { getSupabaseConfig, isSupabaseEnabled, isLogsPrimarySupabase } = require('../config/supabase');
const { getSupabaseHealthReport } = require('../services/supabase/health');
const { closeSupabaseClients } = require('../services/supabase/client');
const {
  COLD_ARCHIVE_TTL_SECONDS,
  COLD_ARCHIVE_COLLECTIONS,
} = require('../utils/mongoColdArchiveTtl');

async function countLegacyNotifications(db) {
  try {
    return await db.collection('notifications').countDocuments();
  } catch {
    return null;
  }
}

async function inspectColdArchiveTtl(db) {
  const results = [];
  for (const spec of COLD_ARCHIVE_COLLECTIONS) {
    try {
      const indexes = await db.collection(spec.collection).indexes();
      const ttl = indexes.find(
        (idx) => idx.expireAfterSeconds != null
          && Object.keys(idx.key || {}).includes(spec.field)
      );
      results.push({
        collection: spec.collection,
        field: spec.field,
        ttlSeconds: ttl?.expireAfterSeconds ?? null,
        ok: ttl?.expireAfterSeconds === COLD_ARCHIVE_TTL_SECONDS,
      });
    } catch (err) {
      results.push({
        collection: spec.collection,
        field: spec.field,
        error: err.message,
        ok: false,
      });
    }
  }
  return results;
}

async function main() {
  const purgeDryRun = process.argv.includes('--purge-dry-run');
  const report = {
    timestamp: new Date().toISOString(),
    mongo: { connected: false, uriSource: null, legacyNotifications: null },
    supabase: (() => {
      const cfg = getSupabaseConfig();
      return {
        ...cfg,
        serviceRoleKey: cfg.serviceRoleKey ? '[set]' : null,
        anonKey: cfg.anonKey ? '[set]' : null,
        dbUrl: cfg.dbUrl ? '[set]' : null,
      };
    })(),
    notifications: {
      runtimeDbWrites: false,
      inboxStorage: 'client localStorage (coreknot_inbox_{userId})',
      legacyCollectionPurgeDryRun: null,
    },
    logs: {
      persistEnv: process.env.PERSIST_SYSTEM_LOGS || 'false',
      primaryStore: isLogsPrimarySupabase() ? 'supabase' : 'mongo',
      mongoArchive: Boolean(process.env.MONGO_LOG_ARCHIVE),
      coldArchiveTtlDays: 90,
    },
    mongoColdArchive: {
      ttlSecondsExpected: COLD_ARCHIVE_TTL_SECONDS,
      collections: [],
    },
  };

  const { dbUri, source } = resolveMongoUri();
  report.mongo.uriSource = source;

  try {
    await mongoose.connect(dbUri, { serverSelectionTimeoutMS: 8000 });
    report.mongo.connected = mongoose.connection.readyState === 1;
    report.mongo.database = mongoose.connection.name;
    report.mongo.legacyNotifications = await countLegacyNotifications(mongoose.connection.db);
    report.mongoColdArchive.collections = await inspectColdArchiveTtl(mongoose.connection.db);

    if (purgeDryRun) {
      report.notifications.legacyCollectionPurgeDryRun = {
        collection: 'notifications',
        count: report.mongo.legacyNotifications,
        action: 'dry-run only — run purgeLocalOnlyCollections.js --execute to remove',
      };
    }
  } catch (err) {
    report.mongo.error = err.message;
  }

  if (isSupabaseEnabled()) {
    try {
      report.supabaseHealth = await getSupabaseHealthReport();
    } catch (err) {
      report.supabaseHealth = { error: err.message };
    }
  } else {
    report.supabaseHealth = {
      configured: report.supabase.configured,
      enabled: false,
      message: 'Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in server/.env to enable',
    };
  }

  console.log(JSON.stringify(report, null, 2));

  await closeSupabaseClients();
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }

  const coldArchiveOk = !report.mongo.connected
    || report.mongoColdArchive.collections.every((c) => c.ok);
  const healthy = report.mongo.connected
    && coldArchiveOk
    && (!isSupabaseEnabled() || report.supabaseHealth?.connection?.ok);
  process.exit(healthy ? 0 : 1);
}

main().catch(async (err) => {
  console.error('Audit failed:', err.message);
  await closeSupabaseClients();
  process.exit(1);
});
