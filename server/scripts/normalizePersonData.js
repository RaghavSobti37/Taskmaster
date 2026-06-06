/**
 * Backfill person identity fields (name, nameKey, email, phone, city) across CRM collections.
 *
 * Usage (from server/):
 *   node scripts/normalizePersonData.js              # dry-run (default)
 *   node scripts/normalizePersonData.js --dry-run
 *   node scripts/normalizePersonData.js --execute
 *   node scripts/normalizePersonData.js --execute --prod   # production (explicit)
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { normalizePersonRecord } = require('../utils/personNormalization');
const { repairCorruptLeadPhones } = require('../services/leadPhoneRepair');

const BYPASS = { bypassTenant: true };
const BATCH = 500;
const NAME_KEY_MIN = 3;

const execute = process.argv.includes('--execute');
const dryRun = !execute;
const useProd = process.argv.includes('--prod');
const uri = useProd
  ? process.env.MONGODB_URI_PROD || process.env.MONGODB_URI
  : process.env.MONGODB_URI;

const stats = {
  leads: { scanned: 0, updated: 0, unchanged: 0, skippedConflict: 0, errors: [] },
  tsc: { scanned: 0, updated: 0, unchanged: 0, errors: [] },
  exly: { scanned: 0, updated: 0, unchanged: 0, errors: [] },
  contacts: { scanned: 0, updated: 0, unchanged: 0, errors: [] },
};

function buildUpdateSet(doc, normalized) {
  const $set = {};
  for (const key of ['name', 'nameKey', 'email', 'phone', 'city']) {
    const beforeVal = doc[key] == null ? '' : String(doc[key]);
    const afterVal = normalized[key] == null ? '' : String(normalized[key]);
    if (beforeVal !== afterVal) {
      $set[key] = normalized[key] ?? '';
    }
  }
  return $set;
}

async function processCollection(Model, collectionKey, { phoneRequired = false } = {}) {
  const cursor = Model.find({}).setOptions(BYPASS).cursor();
  let batch = [];

  for await (const doc of cursor) {
    stats[collectionKey].scanned += 1;
    const plain = doc.toObject ? doc.toObject() : doc;
    const normalized = normalizePersonRecord(
      {
        name: plain.name,
        email: plain.email,
        phone: plain.phone,
        city: plain.city,
      },
      { tryRepairPhone: true, requirePhone: phoneRequired && !!plain.phone }
    );

    if (normalized.errors.length) {
      stats[collectionKey].errors.push({
        id: String(plain._id),
        name: plain.name,
        phone: plain.phone,
        email: plain.email,
        errors: normalized.errors,
      });
      continue;
    }

    const $set = buildUpdateSet(plain, normalized);
    if (Object.keys($set).length === 0) {
      stats[collectionKey].unchanged += 1;
      continue;
    }

    batch.push({ _id: plain._id, tenantId: plain.tenantId, $set, plain, normalized });
    if (batch.length >= BATCH) {
      await flushBatch(Model, collectionKey, batch);
      batch = [];
    }
  }
  if (batch.length) await flushBatch(Model, collectionKey, batch);
}

async function flushBatch(Model, collectionKey, batch) {
  if (dryRun) {
    stats[collectionKey].updated += batch.length;
    return;
  }

  const ops = [];
  for (const item of batch) {
    if (collectionKey === 'leads' && item.$set.phone) {
      const conflict = await Model.findOne({
        tenantId: item.tenantId,
        phone: item.$set.phone,
        _id: { $ne: item._id },
      }).setOptions(BYPASS).select('_id').lean();
      if (conflict) {
        stats.leads.skippedConflict += 1;
        stats.leads.errors.push({
          id: String(item._id),
          reason: 'duplicate_phone_after_normalize',
          conflictId: String(conflict._id),
          phone: item.$set.phone,
        });
        const setWithoutPhone = { ...item.$set };
        delete setWithoutPhone.phone;
        if (Object.keys(setWithoutPhone).length === 0) continue;
        ops.push({
          updateOne: {
            filter: { _id: item._id },
            update: { $set: setWithoutPhone },
          },
        });
        stats[collectionKey].updated += 1;
        continue;
      }
    }
    ops.push({
      updateOne: {
        filter: { _id: item._id },
        update: { $set: item.$set },
      },
    });
    stats[collectionKey].updated += 1;
  }
  if (ops.length) await Model.bulkWrite(ops, { ordered: false });
}

function groupBy(keyFn, docs) {
  const map = new Map();
  for (const doc of docs) {
    const key = keyFn(doc);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(doc);
  }
  return [...map.entries()].filter(([, list]) => list.length > 1);
}

async function buildDuplicateReports() {
  const Lead = require('../models/Lead');
  const Contact = require('../models/Contact');

  const leads = await Lead.find({}).setOptions(BYPASS).select('_id tenantId name nameKey email phone').lean();
  const contacts = await Contact.find({}).setOptions(BYPASS).select('_id tenantId name nameKey email phone').lean();

  const phoneDupes = groupBy(
    (l) => (l.phone && l.tenantId ? `${l.tenantId}:${l.phone}` : ''),
    leads
  );
  const emailDupes = groupBy(
    (l) => (l.email && l.tenantId ? `${l.tenantId}:${l.email}` : ''),
    leads
  );
  const nameKeyDupes = groupBy(
    (l) => (l.nameKey && l.nameKey.length >= NAME_KEY_MIN && l.tenantId ? `${l.tenantId}:${l.nameKey}` : ''),
    leads
  );

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const reportDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

  const report = {
    generatedAt: new Date().toISOString(),
    mode: dryRun ? 'dry-run' : 'execute',
    database: useProd ? 'production' : 'local',
    stats,
    definiteDuplicates: {
      byPhone: phoneDupes.map(([key, ids]) => ({ key, ids: ids.map((d) => ({ _id: d._id, name: d.name, email: d.email, phone: d.phone })) })),
      byEmail: emailDupes.map(([key, ids]) => ({ key, ids: ids.map((d) => ({ _id: d._id, name: d.name, email: d.email, phone: d.phone })) })),
    },
    probableDuplicates: {
      byNameKey: nameKeyDupes.map(([key, ids]) => ({ key, ids: ids.map((d) => ({ _id: d._id, name: d.name, email: d.email, phone: d.phone })) })),
    },
    contactCount: contacts.length,
  };

  const reportPath = path.join(reportDir, `normalize-person-data-${ts}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written: ${reportPath}`);
  console.log(`Definite duplicate groups — phone: ${phoneDupes.length}, email: ${emailDupes.length}`);
  console.log(`Probable duplicate groups — nameKey: ${nameKeyDupes.length}`);
  return reportPath;
}

async function main() {
  if (!uri) {
    console.error('No MongoDB URI in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`${dryRun ? '[DRY RUN] ' : '[EXECUTE] '}Connected (${useProd ? 'production' : 'local'})`);

  const Lead = require('../models/Lead');
  const OutsourcedRecord = require('../models/OutsourcedRecord');
  const BookedCall = require('../models/BookedCall');
  const NewsletterSubscriber = require('../models/NewsletterSubscriber');
  const ExlyBooking = require('../models/ExlyBooking');
  const PersonIndex = require('../models/PersonIndex');

  console.log('\n--- Leads ---');
  await processCollection(Lead, 'leads', { phoneRequired: false });
  console.log(JSON.stringify(stats.leads, null, 2));

  console.log('\n--- OutsourcedRecord ---');
  await processCollection(OutsourcedRecord, 'outsourced');
  console.log(JSON.stringify(stats.outsourced, null, 2));

  console.log('\n--- BookedCall ---');
  await processCollection(BookedCall, 'booked_calls');
  console.log(JSON.stringify(stats.booked_calls, null, 2));

  console.log('\n--- NewsletterSubscriber ---');
  await processCollection(NewsletterSubscriber, 'newsletter');
  console.log(JSON.stringify(stats.newsletter, null, 2));

  console.log('\n--- ExlyBooking ---');
  await processCollection(ExlyBooking, 'exly', { phoneRequired: true });
  console.log(JSON.stringify(stats.exly, null, 2));

  console.log('\n--- PersonIndex ---');
  await processCollection(PersonIndex, 'personindexes');
  console.log(JSON.stringify(stats.personindexes, null, 2));

  if (!dryRun) {
    console.log('\n--- repairCorruptLeadPhones ---');
    const repairStats = await repairCorruptLeadPhones();
    console.log(JSON.stringify(repairStats, null, 2));
  }

  await buildDuplicateReports();
  await mongoose.disconnect();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
