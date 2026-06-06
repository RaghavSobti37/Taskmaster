/**
 * Drop unused MongoDB collections (chat, archives, legacy).
 * Run: node server/scripts/dropOrphanCollections.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const ORPHAN_COLLECTIONS = [
  'chatmessages',
  'chatchannels',
  'messages',
  'socialpostmetadata',
  'departmentchangerequests',
  'logarchives',
  'crmauditarchives',
  'connectedprofiles',
];

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  for (const name of ORPHAN_COLLECTIONS) {
    const exists = (await db.listCollections({ name }).toArray()).length > 0;
    if (!exists) {
      console.log(`skip ${name} (not found)`);
      continue;
    }
    await db.dropCollection(name);
    console.log(`dropped ${name}`);
  }

  await mongoose.disconnect();
  console.log('done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
