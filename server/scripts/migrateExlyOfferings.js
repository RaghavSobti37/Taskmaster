/**
 * One-time Exly offering title migration (pipe-separated titles, ignored demos).
 * Usage: node scripts/migrateExlyOfferings.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { runExlyOfferingMigration } = require('../services/exlyOfferingMigration');

const run = async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGO_URI not set');
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log('Connected. Running Exly offering migration...');
  const result = await runExlyOfferingMigration();
  console.log('Done:', result);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
