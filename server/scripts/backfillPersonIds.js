/**
 * Backfill personId on source collections + build Person spine from PersonIndex.
 * Run: node server/scripts/backfillPersonIds.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const PersonIdentityService = require('../services/PersonIdentityService');
const PersonHubBuilder = require('../services/PersonHubBuilder');

const BATCH = 200;

function logStep(embedded, message, meta) {
  if (embedded) {
    logger.debug('backfillPersonIds', message, meta);
    return;
  }
  if (meta !== undefined) console.log(message, meta);
  else console.log(message);
}

async function backfillCollection(Model, sourceType, getIdentity, { embedded = false } = {}) {
  let skip = 0;
  let updated = 0;
  const total = await Model.countDocuments({ personId: { $exists: false } });
  if (total === 0) return { updated: 0, total: 0 };

  while (skip < total) {
    const batch = await Model.find({ personId: { $exists: false } }).skip(0).limit(BATCH).lean();
    if (!batch.length) break;

    for (const doc of batch) {
      const identity = getIdentity(doc);
      if (!identity.email && !identity.phone) continue;
      const resolved = await PersonIdentityService.resolvePerson(identity, { source: sourceType });
      if (!resolved) continue;
      await Model.updateOne({ _id: doc._id }, { $set: { personId: resolved.personId } });
      await PersonIdentityService.linkSource(resolved.personId, sourceType, doc._id, identity.summary || {});
      updated++;
    }
    skip += BATCH;
    logStep(embedded, `${Model.modelName}: ${Math.min(skip, total)}/${total}`);
  }
  return { updated, total };
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

  const Lead = require('../models/Lead');
  const ExlyBooking = require('../models/ExlyBooking');
  const OutsourcedRecord = require('../models/OutsourcedRecord');
  const BookedCall = require('../models/BookedCall');
  const NewsletterSubscriber = require('../models/NewsletterSubscriber');
  const ArtistPathResponse = require('../models/ArtistPathResponse');

  logStep(embedded, 'Migrating PersonIndex → Person spine...');
  const idxResult = await PersonHubBuilder.rebuildFromPersonIndex({ embedded: true });
  logStep(embedded, 'PersonIndex migrated:', idxResult);

  const jobs = [
    [Lead, 'lead', (d) => ({ name: d.name, email: d.email, phone: d.phone, city: d.city, summary: { leadStatus: d.leadStatus } })],
    [ExlyBooking, 'exly_booking', (d) => ({ name: d.name, email: d.email, phone: d.phone, summary: { offeringTitle: d.offeringTitle } })],
    [OutsourcedRecord, 'outsourced', (d) => ({ name: d.name, email: d.email, phone: d.phone, city: d.city, summary: { campaign: d.campaign } })],
    [BookedCall, 'booked_call', (d) => ({ name: d.name, email: d.email, phone: d.phone, summary: { source: d.source } })],
    [NewsletterSubscriber, 'newsletter', (d) => ({ name: d.name, email: d.email, phone: d.phone, summary: { source: d.source } })],
    [ArtistPathResponse, 'artist_path', (d) => ({ name: d.answers?.name, email: d.answers?.email, phone: d.answers?.phone, summary: d.answers })],
  ];

  for (const [Model, type, fn] of jobs) {
    logStep(embedded, `Backfilling ${Model.modelName}...`);
    const r = await backfillCollection(Model, type, fn, { embedded });
    logStep(embedded, `${Model.modelName} backfill:`, r);
  }

  logStep(embedded, 'Rebuilding PersonHubView for all persons...');
  const hub = await PersonHubBuilder.rebuildAll({
    onProgress: embedded ? (m) => logger.debug('backfillPersonIds', m) : (m) => console.log(m),
  });
  logStep(embedded, 'Hub rebuild:', hub);

  if (!embedded) await mongoose.disconnect();
  logStep(embedded, 'done');
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main };
