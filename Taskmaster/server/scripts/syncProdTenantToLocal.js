#!/usr/bin/env node
/**
 * Tenant-scoped prod → local sync (read-only on production).
 * Copies one org's data; skips CRM/Data Hub + Exly heavy collections;
 * finance documents are metadata/folders only (no file payloads/OCR text).
 *
 *   node server/scripts/syncProdTenantToLocal.js --yes
 *   node server/scripts/syncProdTenantToLocal.js --yes --slug=tsc
 *
 * Env: MONGODB_URI_PROD, MONGODB_URI, PLATFORM_TENANT_SLUG (default tsc).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { MongoClient, ObjectId } = require('mongodb');
const {
  TENANT_SYNC_SKIP_SET,
  FINANCE_LITE_COLLECTION,
  slimFinanceDocument,
  resolveTenantSyncCollections,
  parseTenantSlug,
  parseExcludeList,
} = require('../config/syncCollections');

const BATCH_SIZE = 500;
const INDEX_OPTION_KEYS = new Set([
  'name',
  'unique',
  'sparse',
  'background',
  'expireAfterSeconds',
  'partialFilterExpression',
  'weights',
  'default_language',
  'language_override',
  'textIndexVersion',
  '2dsphereIndexVersion',
  'bits',
  'min',
  'max',
  'bucketSize',
  'wildcardProjection',
  'hidden',
  'collation',
]);

function dbNameFromUri(uri, fallback) {
  if (!uri) return fallback;
  const match = uri.match(/mongodb(\+srv)?:\/\/[^/]+\/([^?]+)/i);
  return match && match[2] ? decodeURIComponent(match[2]) : fallback;
}

function indexOptions(indexSpec) {
  const opts = {};
  for (const key of INDEX_OPTION_KEYS) {
    if (indexSpec[key] !== undefined) opts[key] = indexSpec[key];
  }
  if (indexSpec.name) opts.name = indexSpec.name;
  return opts;
}

async function recreateIndexes(sourceCol, targetCol) {
  try {
    const existing = await targetCol.indexes();
    for (const idx of existing) {
      if (idx.name === '_id_') continue;
      await targetCol.dropIndex(idx.name);
    }
  } catch (err) {
    if (err.codeName !== 'NamespaceNotFound') throw err;
  }

  const specs = await sourceCol.indexes();
  for (const spec of specs) {
    if (spec.name === '_id_') continue;
    await targetCol.createIndex(spec.key, indexOptions(spec));
  }
}

async function collectionUsesTenantFilter(sourceCol, tenantId) {
  const n = await sourceCol.countDocuments({ tenantId }, { limit: 1 });
  return n > 0;
}

function transformDoc(colName, doc) {
  if (colName.toLowerCase() === FINANCE_LITE_COLLECTION) {
    return slimFinanceDocument(doc);
  }
  return doc;
}

async function copyFilteredCollection(sourceCol, targetDb, colName, filter, { transform } = {}) {
  const targetCol = targetDb.collection(colName);
  try {
    await targetCol.drop();
  } catch (err) {
    if (err.codeName !== 'NamespaceNotFound') throw err;
  }
  const freshTarget = targetDb.collection(colName);
  await recreateIndexes(sourceCol, freshTarget);

  const total = await sourceCol.countDocuments(filter);
  if (total === 0) {
    return { name: colName, count: 0 };
  }

  let copied = 0;
  const cursor = sourceCol.find(filter).batchSize(BATCH_SIZE);
  let batch = [];

  for await (const raw of cursor) {
    const doc = transform ? transform(raw) : raw;
    batch.push(doc);
    if (batch.length >= BATCH_SIZE) {
      await freshTarget.insertMany(batch, { ordered: false });
      copied += batch.length;
      batch = [];
      process.stdout.write(`  ${colName}: ${copied}/${total}\r`);
    }
  }
  if (batch.length) {
    await freshTarget.insertMany(batch, { ordered: false });
    copied += batch.length;
  }
  process.stdout.write(`  ${colName}: ${copied}/${total}    \n`);
  return { name: colName, count: copied };
}

async function buildSyncContext(prodDb, tenantId) {
  const taskIds = await prodDb
    .collection('tasks')
    .distinct('_id', { tenantId });
  const membershipUserIds = await prodDb
    .collection('tenantmemberships')
    .distinct('userId', { tenantId });
  const tenantUserIds = await prodDb.collection('users').distinct('_id', { tenantId });
  const userIds = [...new Set([...membershipUserIds, ...tenantUserIds].map(String))].map(
    (id) => new ObjectId(id)
  );

  return { tenantId, taskIds, userIds };
}

async function resolveFilter(sourceCol, colName, ctx) {
  const key = colName.toLowerCase();

  if (key === 'tenants') {
    return { _id: ctx.tenantId };
  }

  if (key === 'users') {
    return {
      $or: [{ tenantId: ctx.tenantId }, { _id: { $in: ctx.userIds } }],
    };
  }

  if (key === 'taskassignments') {
    if (await collectionUsesTenantFilter(sourceCol, ctx.tenantId)) {
      return { tenantId: ctx.tenantId };
    }
    return { taskId: { $in: ctx.taskIds } };
  }

  if (await collectionUsesTenantFilter(sourceCol, ctx.tenantId)) {
    return { tenantId: ctx.tenantId };
  }

  if (key === 'tenantmemberships' || key === 'tenantinvites') {
    return { tenantId: ctx.tenantId };
  }

  return null;
}

async function main() {
  const confirmed =
    process.argv.includes('--yes') ||
    process.argv.includes('-y') ||
    process.env.SYNC_PROD_TO_LOCAL_CONFIRM === '1';

  if (!confirmed) {
    console.error(
      'Tenant-scoped prod → local sync (skips Data Hub / Exly; finance metadata-only).\n' +
        'Re-run: node server/scripts/syncProdTenantToLocal.js --yes [--slug=tsc]'
    );
    process.exit(1);
  }

  const slug = parseTenantSlug();
  const extraExclude = parseExcludeList();
  const prodUri = process.env.MONGODB_URI_PROD;
  const localUri = process.env.MONGODB_URI;
  if (!prodUri || !localUri) {
    console.error('Missing MONGODB_URI_PROD or MONGODB_URI in server/.env');
    process.exit(1);
  }

  const prodDbName = process.env.MONGODB_DB_PROD || dbNameFromUri(prodUri, 'taskmaster_production');
  const localDbName = process.env.MONGODB_DB_LOCAL || dbNameFromUri(localUri, 'taskmaster_local');

  if (!localDbName.includes('local') && process.env.SYNC_ALLOW_NON_LOCAL_TARGET !== '1') {
    console.error(
      `Refusing to write to target DB "${localDbName}" (expected *local* in name).\n` +
        'Set SYNC_ALLOW_NON_LOCAL_TARGET=1 to override.'
    );
    process.exit(1);
  }

  const prodClient = new MongoClient(prodUri, {
    readPreference: 'secondaryPreferred',
    serverSelectionTimeoutMS: 120000,
    connectTimeoutMS: 60000,
  });
  const localClient = new MongoClient(localUri);
  const summary = [];

  try {
    await prodClient.connect();
    await localClient.connect();

    const prodDb = prodClient.db(prodDbName);
    const localDb = localClient.db(localDbName);

    const tenant = await prodDb.collection('tenants').findOne({ slug });
    if (!tenant) {
      console.error(`Tenant slug "${slug}" not found in prod DB ${prodDbName}`);
      process.exit(1);
    }

    const ctx = await buildSyncContext(prodDb, tenant._id);
    console.log(
      `Sync tenant "${tenant.name}" (${slug}) ${prodDbName} → ${localDbName} [id=${tenant._id}]`
    );
    console.log(`Context: ${ctx.taskIds.length} tasks, ${ctx.userIds.length} users`);

    const prodCollections = (await prodDb.listCollections().toArray()).filter(
      (c) => !c.name.startsWith('system.')
    );
    const prodNames = new Set(prodCollections.map((c) => c.name));
    const toSync = resolveTenantSyncCollections(
      prodCollections.map((c) => c.name),
      extraExclude
    );
    const skipped = prodCollections
      .map((c) => c.name)
      .filter((n) => TENANT_SYNC_SKIP_SET.has(n.toLowerCase()) || extraExclude.includes(n));
    if (skipped.length) {
      console.log(`Skipping ${skipped.length} heavy collection(s): ${skipped.sort().join(', ')}`);
    }

    const localCollections = (await localDb.listCollections().toArray()).filter(
      (c) => !c.name.startsWith('system.')
    );
    for (const lc of localCollections) {
      if (!prodNames.has(lc.name) || TENANT_SYNC_SKIP_SET.has(lc.name.toLowerCase())) {
        console.log(`Drop local collection: ${lc.name}`);
        await localDb.collection(lc.name).drop();
      }
    }

    for (const skipName of skipped) {
      if (localCollections.some((c) => c.name === skipName)) {
        console.log(`Purge skipped collection on local: ${skipName}`);
        await localDb.collection(skipName).drop().catch(() => {});
      }
    }

    for (const name of toSync) {
      const sourceCol = prodDb.collection(name);
      const filter = await resolveFilter(sourceCol, name, ctx);
      if (!filter) {
        console.log(`Skip (no tenant scope): ${name}`);
        await localDb.collection(name).drop().catch(() => {});
        continue;
      }

      const transform =
        name.toLowerCase() === FINANCE_LITE_COLLECTION
          ? (doc) => transformDoc(name, doc)
          : undefined;

      console.log(`Copy: ${name}`);
      const stats = await copyFilteredCollection(sourceCol, localDb, name, filter, { transform });
      summary.push(stats);
    }

    console.log('\nDone. Collection document counts:');
    for (const row of summary.sort((a, b) => a.name.localeCompare(b.name))) {
      console.log(`  ${row.name}: ${row.count}`);
    }
    console.log('\nRestart local API. MAIL_USE_PROD_DB should stay false.');
  } finally {
    await prodClient.close().catch(() => {});
    await localClient.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
