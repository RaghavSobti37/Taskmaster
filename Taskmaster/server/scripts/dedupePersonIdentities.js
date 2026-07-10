/**
 * Merge split Person records that share identifiers (email-only vs phone-only duplicates).
 * Run: node server/scripts/dedupePersonIdentities.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const PersonIdentifier = require('../models/PersonIdentifier');
const PersonIdentityService = require('../services/PersonIdentityService');
const PersonHubBuilder = require('../services/PersonHubBuilder');

async function main({ embedded = false } = {}) {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!embedded) {
    if (!uri) {
      console.error('MONGODB_URI not set');
      process.exit(1);
    }
    await mongoose.connect(uri);
  }

  const dupes = await PersonIdentifier.aggregate([
    { $group: { _id: { type: '$type', value: '$valueNormalized' }, personIds: { $addToSet: '$personId' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);

  let merged = 0;
  for (const row of dupes) {
    const ids = row.personIds.map(String);
    const primary = ids[0];
    for (let i = 1; i < ids.length; i++) {
      await PersonIdentityService._mergePersonIds(primary, ids[i]);
      merged++;
    }
  }

  console.log(`Merged ${merged} duplicate person pairs from ${dupes.length} identifier conflicts`);
  const hub = await PersonHubBuilder.rebuildAll({ onProgress: (m) => console.log(m) });
  console.log('Hub rebuild:', hub);

  if (!embedded) await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main };
