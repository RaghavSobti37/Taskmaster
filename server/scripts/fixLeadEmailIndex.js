/**
 * Drop legacy sparse email index (collides on null/"") and apply partial unique index.
 * Also unset empty/null emails on existing leads.
 * Run: node server/scripts/fixLeadEmailIndex.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Lead = require('../models/Lead');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const col = Lead.collection;

  const unset = await Lead.updateMany(
    { $or: [{ email: '' }, { email: null }] },
    { $unset: { email: 1 } },
    { bypassTenant: true }
  );
  console.log(`Unset empty/null email on ${unset.modifiedCount} leads`);

  const indexes = await col.indexes();
  const legacy = indexes.find((idx) => idx.name === 'tenantId_1_email_1');
  if (legacy) {
    await col.dropIndex('tenantId_1_email_1');
    console.log('Dropped legacy tenantId_1_email_1 sparse index');
  }

  await Lead.syncIndexes();
  console.log('Synced Lead indexes (partial unique email index active)');
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
