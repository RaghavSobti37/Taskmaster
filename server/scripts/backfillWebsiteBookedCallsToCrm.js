/**
 * Backfill website book-a-call rows into CRM leads + followups (Satyam only).
 *
 * Sources (all enabled by default):
 *   1. Google Sheet BookedCalls tab (TSC website legacy append)
 *   2. MongoDB bookedcalls collection
 *
 * Usage:
 *   node server/scripts/backfillWebsiteBookedCallsToCrm.js [--dry-run]
 *   node server/scripts/backfillWebsiteBookedCallsToCrm.js --reassign-only [--dry-run]
 *
 * Requires MONGODB_URI (or MONGO_URI) in server/.env or env.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const BookedCall = require('../models/BookedCall');
const User = require('../models/User');
const { BOOKED_CALL_SOURCE_RE } = require('../../shared/dataInlets');
const { bypassOptions } = require('../infrastructure/database/bypassTenantPolicy');
const { processBookedCallLogic } = require('../controllers/webhookController');
const { runWithDefaultWebhookTenant } = require('../utils/webhookTenantContext');
const { resolveSatyamSalesRepId } = require('../utils/bookedCallRepAssignment');
const { fetchBookedCallsFromSheet } = require('../utils/bookedCallSheetImport');

const BYPASS = bypassOptions('backfill-website-booked-calls');

function bookedCallDocToPayload(doc) {
  const meta = doc.metadata || {};
  const bookedAt = doc.bookedAt ? new Date(doc.bookedAt) : doc.createdAt ? new Date(doc.createdAt) : null;
  if (!bookedAt || Number.isNaN(bookedAt.getTime())) return null;

  const date = meta.date
    || `${bookedAt.getFullYear()}-${String(bookedAt.getMonth() + 1).padStart(2, '0')}-${String(bookedAt.getDate()).padStart(2, '0')}`;
  let time = meta.time;
  if (!time) {
    time = bookedAt.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });
  }

  return {
    source: 'tsc-website-bookedcall-collection',
    name: doc.name,
    email: doc.email,
    phone: doc.phone,
    whatsapp: doc.phone,
    course: meta.course || meta.courseName || doc.source || 'Website Booking',
    date,
    time,
    timezone: meta.timezone || 'Asia/Kolkata',
  };
}

async function reassignBookedCallsToSatyam(dryRun, satyamId) {
  const aryaman = await User.findOne({
    $or: [{ repId: 'sr09' }, { name: /aryaman/i }, { email: /aryaman/i }],
  }).setOptions(BYPASS).select('_id name').lean();

  const filter = {
    leadStatus: { $ne: 'Converted' },
    $or: [
      { source: { $regex: BOOKED_CALL_SOURCE_RE.source, $options: 'i' } },
      { source: 'Website Booking' },
    ],
  };

  if (aryaman?._id) {
    filter.$or.push({ assignedRepId: aryaman._id });
  }

  const leads = await Lead.find(filter).setOptions(BYPASS).select('_id name source assignedRepId').lean();
  const toUpdate = leads.filter((l) => String(l.assignedRepId) !== String(satyamId));

  console.log(`Reassign: ${toUpdate.length} booked-call leads → Satyam (${satyamId})`);
  if (!dryRun && toUpdate.length) {
    const result = await Lead.updateMany(
      { _id: { $in: toUpdate.map((l) => l._id) } },
      { $set: { assignedRepId: satyamId } },
    ).setOptions(BYPASS);
    console.log(`Reassigned ${result.modifiedCount} leads`);
  }
  return toUpdate.length;
}

async function upsertFromPayload(payload, satyamId, dryRun) {
  if (dryRun) {
    console.log(`[dry-run] would upsert: ${payload.name} | ${payload.email || payload.phone} | ${payload.date} ${payload.time}`);
    return { ok: true, dryRun: true };
  }

  return runWithDefaultWebhookTenant(() =>
    processBookedCallLogic(payload, {
      skipSlotValidation: true,
      skipNotifications: true,
      forceRepId: satyamId,
    })
  );
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const reassignOnly = process.argv.includes('--reassign-only');

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI or MONGO_URI required');

  await mongoose.connect(uri);

  const satyamId = await resolveSatyamSalesRepId();
  if (!satyamId) throw new Error('Satyam not found in sales department');

  console.log(`Satyam rep id: ${satyamId}`);
  console.log(dryRun ? '[DRY RUN]' : '[WRITE MODE]');

  const reassigned = await reassignBookedCallsToSatyam(dryRun, satyamId);

  if (reassignOnly) {
    console.log(`Done (reassign-only). Touched ${reassigned} leads.`);
    await mongoose.disconnect();
    return;
  }

  const sheetResult = await fetchBookedCallsFromSheet();
  if (sheetResult.skipped) {
    console.warn(`Sheet import skipped: ${sheetResult.skipped}`);
  } else {
    console.log(`Sheet "${sheetResult.tabName}": ${sheetResult.rows.length} rows (${sheetResult.spreadsheetId})`);
  }

  const bookedCallDocs = await BookedCall.find({}).setOptions(BYPASS).lean();
  console.log(`BookedCall collection: ${bookedCallDocs.length} docs`);

  const payloads = [];
  const seen = new Set();

  for (const row of sheetResult.rows || []) {
    const key = `${(row.email || '').toLowerCase()}|${row.phone || ''}|${row.date}|${row.time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    payloads.push(row);
  }

  for (const doc of bookedCallDocs) {
    const payload = bookedCallDocToPayload(doc);
    if (!payload?.name || (!payload.email && !payload.phone)) continue;
    const key = `${(payload.email || '').toLowerCase()}|${payload.phone || ''}|${payload.date}|${payload.time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    payloads.push(payload);
  }

  console.log(`Processing ${payloads.length} unique booking payloads…`);

  let ok = 0;
  let failed = 0;
  for (const payload of payloads) {
    try {
      await upsertFromPayload(payload, satyamId, dryRun);
      ok += 1;
    } catch (err) {
      failed += 1;
      console.error(`FAIL ${payload.name}: ${err.message}`);
    }
  }

  console.log(`\nBackfill complete: ${ok} ok, ${failed} failed, ${reassigned} reassigned`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch (_) { /* ignore */ }
  process.exit(1);
});
